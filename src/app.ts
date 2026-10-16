import Fastify, { type FastifyError } from 'fastify';
import type { AppConfig } from './config.js';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { createDatabase, type Database } from './database/index.js';
import { ApiError } from './errors.js';
import { authorization } from './modules/authorization/index.js';
import { authRoutes } from './modules/auth/routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import multipart from '@fastify/multipart';
import { memoryRevocations, redisRevocations, type TokenRevocations } from './modules/auth/revocations.js';
import { cloudinaryStorage } from './adapters/cloudinary.js';
import { mediaRoutes } from './modules/media/routes.js';
import type { MediaStorage } from './modules/media/types.js';
import { investigationRoutes } from './modules/investigations/routes.js';
import { investigationJobs } from './adapters/investigation-jobs.js';
import type { InvestigationJobs } from './modules/investigations/types.js';

export function buildApp(config: AppConfig, database?: Database,
  dependencies: { storage?: MediaStorage; revocations?: TokenRevocations; jobs?: InvestigationJobs } = {}) {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        censor: '[REDACTED]',
      },
    },
    bodyLimit: 1024 * 1024,
    ajv: { customOptions: { removeAdditional: false } },
  });

  // Liveness only: this does not claim database or provider readiness.
  app.get('/health', async () => ({ status: 'ok', service: 'padicheck-backend' }));

  const db = database ?? createDatabase(config.databaseUrl);
  if (!database) app.addHook('onClose', async () => db.close());
  const revocations = dependencies.revocations ?? (config.redisUrl ? redisRevocations(config.redisUrl) : memoryRevocations());
  if (!dependencies.revocations) app.addHook('onClose', async () => revocations.close());
  const storage = dependencies.storage ?? (config.cloudinary ? cloudinaryStorage(config.cloudinary) : undefined);
  const jobs = dependencies.jobs ?? (config.redisUrl ? investigationJobs(config.redisUrl) : undefined);
  if (jobs && !dependencies.jobs) app.addHook('onClose', async () => jobs.close());

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message }, request_id: request.id });
    }
    const frameworkError = error as FastifyError;
    if (frameworkError.validation) {
      return reply.code(400).send({ error: { code: 'invalid_request', message: 'Request validation failed' }, request_id: request.id });
    }
    if (frameworkError.statusCode && frameworkError.statusCode < 500) {
      return reply.code(frameworkError.statusCode).send({ error: { code: 'request_rejected', message: frameworkError.statusCode === 429 ? 'Too many requests' : 'Request rejected' }, request_id: request.id });
    }
    // Do not log arbitrary provider/database messages which can contain secrets.
    request.log.error({ request_id: request.id }, 'Request failed');
    return reply.code(500).send({ error: { code: 'internal_error', message: 'The request could not be completed' }, request_id: request.id });
  });

  app.get('/ready', async (_request, reply) => {
    try {
      await db.query(`SELECT u.users_id, a.auth_account_id, r.role_id, ur.users_id,
        p.permission_id, rp.role_id, m.provider_asset_id, m.provider_public_id,
        m.provider_resource_type, m.provider_delivery_type, m.provider_version, m.upload_status
        FROM users u, user_auth_accounts a, roles r, user_roles ur,
        permissions p, role_permissions rp, media_files m LIMIT 0`);
      await db.query(`SELECT i.investigation_id, i.user_id, i.status, i.input_data, e.entity_id,
        ident.identifier_id, target.investigation_target_id, s.source_id, link.used_in_analysis
        FROM investigations i, entities e, identifiers ident, investigation_targets target,
        sources s, investigation_sources link LIMIT 0`);
      await revocations.ping();
      if (jobs) await jobs.ping();
      return { status: 'ready', background_jobs: jobs ? 'configured' : 'unconfigured' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  app.register(async api => {
    await api.register(jwt, {
      secret: config.jwtSecret,
      sign: { algorithm: 'HS256', expiresIn: '15m', iss: 'padicheck', aud: 'padicheck-api' },
      verify: { algorithms: ['HS256'], allowedIss: 'padicheck', allowedAud: 'padicheck-api' },
    });
    await api.register(rateLimit, { global: false });
    await api.register(multipart, { limits: { files: 1, fields: 0, parts: 1, fileSize: config.uploadMaxBytes } });
    const access = authorization(api, db, revocations);
    await authRoutes(api, db, access, revocations);
    await adminRoutes(api, db, access);
    await mediaRoutes(api, db, access, storage, config.uploadMaxBytes);
    await investigationRoutes(api, db, access, jobs);
  });

  return app;
}
