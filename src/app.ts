import Fastify from 'fastify';
import type { AppConfig } from './config.js';

export function buildApp(config: AppConfig) {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        censor: '[REDACTED]',
      },
    },
    bodyLimit: 1024 * 1024,
  });

  // Liveness only: this does not claim database or provider readiness.
  app.get('/health', async () => ({ status: 'ok', service: 'padicheck-backend' }));

  return app;
}
