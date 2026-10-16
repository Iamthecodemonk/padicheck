import Fastify, { type FastifyError, type FastifyBaseLogger } from 'fastify';
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
import { researchAdminRoutes } from './modules/research/admin-routes.js';
import { directoryRoutes } from './modules/directory/routes.js';
import { trustRoutes } from './modules/trust/routes.js';
import { sharingRoutes } from './modules/sharing/routes.js';
import { databaseReadiness, researchReadiness } from './runtime/readiness.js';
import { redisAuthChallenges } from './adapters/auth-challenges.js';
import { smtpMailer } from './adapters/smtp.js';
import { googleIdentity } from './adapters/google-identity.js';
import type { AuthDependencies } from './modules/auth/identity-types.js';
import { createLogger } from './logger.js';

export function buildApp(config: AppConfig, database?: Database,
  dependencies: { storage?: MediaStorage; revocations?: TokenRevocations; jobs?: InvestigationJobs; auth?: AuthDependencies } = {}) {
  const app = Fastify({
    loggerInstance: createLogger('api', config.logLevel) as FastifyBaseLogger,
    bodyLimit: 1024 * 1024,
    trustProxy: config.trustProxy,
    requestTimeout: config.requestTimeoutMs,
    forceCloseConnections: 'idle',
    ajv: { customOptions: { removeAdditional: false } },
  });

  // Liveness only: this does not claim database or provider readiness.
  app.get('/health', async () => ({ status: 'ok', service: 'padicheck-backend' }));

  const db = database ?? createDatabase(config.databaseUrl);
  const revocations = dependencies.revocations ?? (config.redisUrl ? redisRevocations(config.redisUrl) : memoryRevocations());
  const storage = dependencies.storage ?? (config.cloudinary ? cloudinaryStorage(config.cloudinary) : undefined);
  const jobs = dependencies.jobs ?? (config.redisUrl ? investigationJobs(config.redisUrl) : undefined);
  const identity:AuthDependencies={
    challenges:dependencies.auth?.challenges??(config.redisUrl?redisAuthChallenges(config.redisUrl):undefined),
    mailer:dependencies.auth?.mailer??(config.smtp?smtpMailer(config.smtp):undefined),
    google:dependencies.auth?.google??(config.googleClientId?googleIdentity(config.googleClientId):undefined),
  };
  app.addHook('onClose', async () => {
    const results = await Promise.allSettled([
      ...(!dependencies.jobs && jobs ? [Promise.resolve().then(()=>jobs.close())] : []),
      ...(!dependencies.revocations ? [Promise.resolve().then(()=>revocations.close())] : []),
      ...(!database ? [Promise.resolve().then(()=>db.close())] : []),
      ...(!dependencies.auth?.challenges&&identity.challenges?[identity.challenges.close()]:[]),
      ...(!dependencies.auth?.mailer&&identity.mailer?[Promise.resolve().then(()=>identity.mailer!.close())]:[]),
    ]);
    if (results.some(result => result.status === 'rejected')) throw new Error('Resource cleanup failed');
  });
  let draining = false;
  app.addHook('preClose', async () => { draining = true; });
  app.addHook('onSend', async (request, reply, payload) => {
    if (draining) reply.header('Connection','close');
    if (['/health','/ready'].includes(request.url.split('?')[0]!)) reply.header('Cache-Control','no-store');
    return payload;
  });

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
      await databaseReadiness(db);
      await researchReadiness(db,config);
      await revocations.ping();
      if (jobs) await jobs.ping();
      if(identity.challenges&&(identity.mailer||identity.google))await identity.challenges.ping();
      return { status: 'ready', background_jobs: jobs ? 'configured' : 'unconfigured',
        media_storage: storage ? 'configured' : 'unconfigured', research: config.researchEnabled ? 'enabled' : 'disabled',
        email_signup:identity.mailer&&identity.challenges?'configured':'unconfigured',google_signin:identity.google&&identity.challenges?'configured':'unconfigured' };
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
    await authRoutes(api, db, access, revocations, identity, config.jwtSecret);
    await adminRoutes(api, db, access);
    await researchAdminRoutes(api, db, access);
    await mediaRoutes(api, db, access, storage, config.uploadMaxBytes);
    await investigationRoutes(api, db, access, jobs, config.researchEnabled);
    await directoryRoutes(api, db, access);
    await trustRoutes(api, db, access);
    await sharingRoutes(api, db, access);
  });

  return app;
}
