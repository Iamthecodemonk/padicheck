import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import { ApiError } from '../../errors.js';
import { auditShare, issueShare, lockOwned, resolveShare, shareFields } from './service.js';

const id = { type: 'string', format: 'uuid' };
const params = { type: 'object', additionalProperties: false, required: ['investigation_id'], properties: { investigation_id: id } };
type Params = { investigation_id: string; share_link_id: string };

export async function sharingRoutes(app: FastifyInstance, db: Database, access: Authorization) {
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/v1/shared-investigations') || /\/share-links(?:\/|\?|$)/.test(request.url)) {
      reply.header('Cache-Control', 'no-store');
      reply.header('Referrer-Policy', 'no-referrer');
      reply.header('X-Robots-Tag', 'noindex, nofollow, noarchive');
      reply.header('X-Content-Type-Options', 'nosniff');
    }
    return payload;
  });

  app.post<{ Params: Params; Body: { acknowledge_sensitive_content: true; ttl_seconds?: number } }>('/v1/investigations/:investigation_id/share-links', {
    onRequest: access.requirePermission('investigations.create'), bodyLimit: 1024,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, schema: { params, body: { type: 'object', additionalProperties: false,
      required: ['acknowledge_sensitive_content'], properties: { acknowledge_sensitive_content: { type: 'boolean', const: true },
        ttl_seconds: { type: 'integer', minimum: 60, maximum: 2592000, default: 604800 } } } },
  }, async (request, reply) => {
    if (!access.can(request.principal!, 'investigations.read_own') && !access.can(request.principal!, 'investigations.read_all')) {
      throw new ApiError(403, 'forbidden', 'Investigation read permission is required to share');
    }
    return reply.code(201).send(await issueShare(db, request, request.params.investigation_id, request.body.ttl_seconds ?? 604800));
  });

  app.get<{ Params: Params; Querystring: { limit?: number; offset?: number } }>('/v1/investigations/:investigation_id/share-links', {
    onRequest: access.authenticate, schema: { params, querystring: { type: 'object', additionalProperties: false, properties: {
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 },
    } } },
  }, async request => {
    const owned = await db.query('SELECT 1 FROM investigations WHERE investigation_id = $1 AND user_id = $2', [request.params.investigation_id, request.principal!.users_id]);
    if (!owned.rowCount) throw new ApiError(404, 'investigation_not_found', 'Investigation was not found');
    return { shares: (await db.query(`SELECT ${shareFields},
      (revoked_at IS NULL AND expires_at > clock_timestamp()) AS active FROM investigation_share_links
      WHERE investigation_id = $1 ORDER BY created_at DESC,share_link_id DESC LIMIT $2 OFFSET $3`,
    [request.params.investigation_id, request.query.limit ?? 20, request.query.offset ?? 0])).rows };
  });

  app.post<{ Params: Params }>('/v1/investigations/:investigation_id/share-links/:share_link_id/revoke', {
    onRequest: access.authenticate, schema: { params: { ...params, required: ['investigation_id','share_link_id'], properties: { ...params.properties, share_link_id: id } } },
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async request => db.transaction(async client => {
    await lockOwned(client, request.params.investigation_id, request.principal!.users_id);
    const row = (await client.query(`SELECT ${shareFields} FROM investigation_share_links
      WHERE investigation_id = $1 AND share_link_id = $2 FOR UPDATE`, [request.params.investigation_id, request.params.share_link_id])).rows[0];
    if (!row) throw new ApiError(404, 'share_not_found', 'Share was not found');
    if (row.revoked_at) return { share: row };
    const after = (await client.query(`UPDATE investigation_share_links SET revoked_at = clock_timestamp()
      WHERE share_link_id = $1 RETURNING ${shareFields}`, [row.share_link_id])).rows[0]!;
    await auditShare(client, request, 'investigations.share.revoke', row.share_link_id, after);
    return { share: after };
  }));

  app.post<{ Body: { token: string } }>('/v1/shared-investigations/resolve', {
    bodyLimit: 1024, config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: { querystring: { type: 'object', additionalProperties: false }, body: { type: 'object', additionalProperties: false,
      required: ['token'], properties: { token: { type: 'string', maxLength: 200 } } } },
  }, async request => resolveShare(db, request.body.token));
}
