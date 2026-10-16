import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import { verificationRoutes } from './verifications.js';
import { reportRoutes } from './reports.js';
import { disputeRoutes } from './disputes.js';

export async function trustRoutes(app: FastifyInstance, db: Database, access: Authorization) {
  app.addHook('onSend', async (request, reply, payload) => {
    if (/^\/v1\/(admin|verifications|reports|disputes)(\/|\?|$)/.test(request.url) || request.url.startsWith('/v1/directory')) {
      reply.header('Cache-Control', 'no-store');
    }
    return payload;
  });
  await verificationRoutes(app, db, access);
  await reportRoutes(app, db, access);
  await disputeRoutes(app, db, access);
}
