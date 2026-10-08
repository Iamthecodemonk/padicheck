import Fastify, { type FastifyError } from 'fastify';
import type { AppConfig } from './config.js';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { createDatabase, type Database } from './database/index.js';
import { ApiError } from './errors.js';
import { authorization } from './modules/authorization/index.js';
import { authRoutes } from './modules/auth/routes.js';
import { adminRoutes } from './modules/admin/routes.js';

export function buildApp(config: AppConfig, database?: Database) {
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
      await db.query('SELECT 1 FROM users LIMIT 0');
      return { status: 'ready' };
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
    const access = authorization(api, db);
    await authRoutes(api, db, access);
    await adminRoutes(api, db, access);
  });

  return app;
}
