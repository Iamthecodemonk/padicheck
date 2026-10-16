import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';
import { deadline, gracefulShutdown } from './lifecycle.js';

export function apiRuntime(app: FastifyInstance, config: AppConfig) {
  let closing = false;
  const close = gracefulShutdown({
    timeoutMs: config.shutdownTimeoutMs,
    steps: [{ name: 'api', close: () => app.close() }],
    onError: () => { console.error('API shutdown failed'); process.exitCode = 1; },
  });
  const shutdown = () => { closing = true; return close(); };
  return {
    shutdown,
    async start() {
      try {
        if (config.nodeEnv === 'production') {
          const ready = await deadline(app.inject({ method: 'GET', url: '/ready' }), config.startupTimeoutMs);
          if (ready.statusCode !== 200) throw new Error('Production dependencies are unavailable');
        }
        if (!closing) await app.listen({ port: config.port, host: config.host });
      } catch {
        await shutdown();
        throw new Error('API startup failed; check configuration and dependency readiness');
      }
    },
  };
}
