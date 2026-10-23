import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import { ApiError } from '../../errors.js';
import { audit, body, pagination, params, text, uuid, type Page } from '../trust/shared.js';

const publicFields = `b.business_profile_id, b.entity_id, b.business_category, b.profile_description,
  e.canonical_name, e.country_code, e.city, b.created_at, b.updated_at`;

export async function directoryRoutes(app: FastifyInstance, db: Database, access: Authorization) {
  app.get<{ Querystring: Page & { q?: string; category?: string } }>('/v1/directory', {
    schema: { querystring: { ...pagination, properties: { ...pagination.properties, q: text(120), category: text(100) } } },
    config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
  }, async request => ({ businesses: (await db.query(`SELECT ${publicFields}
    FROM business_profiles b JOIN entities e ON e.entity_id = b.entity_id WHERE b.profile_status = 'published'
    AND ($1::text IS NULL OR position(lower($1) in lower(e.canonical_name)) > 0)
    AND ($2::text IS NULL OR b.business_category = $2)
    ORDER BY b.created_at DESC, b.business_profile_id DESC LIMIT $3 OFFSET $4`,
  [request.query.q ?? null, request.query.category ?? null, request.query.limit ?? 20, request.query.offset ?? 0])).rows }));

  app.get<{ Params: { id: string } }>('/v1/directory/:id', { schema: { params: params('id') } }, async request => {
    const entry = (await db.query(`SELECT ${publicFields} FROM business_profiles b JOIN entities e ON e.entity_id = b.entity_id
      WHERE b.business_profile_id = $1 AND b.profile_status = 'published'`, [request.params.id])).rows[0];
    if (!entry) throw new ApiError(404, 'business_not_found', 'Business was not found');
    const identifiers = await db.query(`SELECT identifier_type, value FROM identifiers WHERE entity_id = $1 AND visibility = 'public'
      ORDER BY identifier_type, identifier_id`, [entry.entity_id]);
    const review = await db.query(`SELECT status, reviewed_at FROM business_verification_requests WHERE business_profile_id = $1
      AND status IN ('approved','rejected') AND reviewed_at>=COALESCE((SELECT (to_jsonb(bp)->'profile_details'->>'verification_invalidated_at')::timestamptz FROM business_profiles bp WHERE business_profile_id=$1),'-infinity'::timestamptz) ORDER BY reviewed_at DESC, verification_request_id DESC LIMIT 1`, [request.params.id]);
    return { business: entry, identifiers: identifiers.rows, verification_review: review.rows[0] ?? null,
      limitations: ['A verification review records a staff decision about submitted evidence; it does not guarantee business conduct or validate user reports.'] };
  });

  app.get<{ Querystring: Page }>('/v1/admin/businesses', {
    onRequest: access.requirePermission('businesses.manage'), schema: { querystring: pagination },
  }, async request => ({ businesses: (await db.query(`SELECT b.*, e.canonical_name FROM business_profiles b
    JOIN entities e ON e.entity_id = b.entity_id ORDER BY b.created_at DESC, b.business_profile_id DESC LIMIT $1 OFFSET $2`,
  [request.query.limit ?? 20, request.query.offset ?? 0])).rows }));

  type Create = { entity_id?: string; canonical_name?: string; country_code?: string; city?: string; business_category: string; profile_description?: string };
  app.post<{ Body: Create }>('/v1/admin/businesses', { onRequest: access.requirePermission('businesses.manage'),
    schema: { body: body({ entity_id: uuid, canonical_name: text(200), country_code: { type: 'string', pattern: '^[A-Z]{2}$' }, city: text(150),
      business_category: text(100), profile_description: text(5000) }, ['business_category']) },
  }, async (request, reply) => {
    const input = request.body;
    if (input.entity_id ? input.canonical_name !== undefined || input.country_code !== undefined || input.city !== undefined : !input.canonical_name) {
      throw new ApiError(400, 'invalid_business', 'Supply an existing entity_id or a new canonical_name and location');
    }
    const profile = await db.transaction(async client => {
      let entityId = input.entity_id;
      if (entityId) {
        const existing = (await client.query("SELECT entity_id, entity_type FROM entities WHERE entity_id = $1 FOR UPDATE", [entityId])).rows[0];
        if (!existing || existing.entity_type !== 'business') throw new ApiError(400, 'invalid_business_entity', 'An existing business entity is required');
        if ((await client.query('SELECT 1 FROM business_profiles WHERE entity_id = $1', [entityId])).rowCount) {
          throw new ApiError(409, 'business_exists', 'This entity already has a business profile');
        }
      } else {
        entityId = (await client.query(`INSERT INTO entities (entity_type,canonical_name,country_code,city)
          VALUES ('business',$1,$2,$3) RETURNING entity_id`, [input.canonical_name, input.country_code ?? null, input.city ?? null])).rows[0]!.entity_id;
      }
      const row = (await client.query(`INSERT INTO business_profiles (entity_id,business_category,profile_description)
        VALUES ($1,$2,$3) RETURNING *`, [entityId, input.business_category, input.profile_description ?? null])).rows[0]!;
      await audit(client, request, 'businesses.create', 'business_profile', row.business_profile_id, null, row);
      return row;
    });
    return reply.code(201).send({ business: profile });
  });

  app.patch<{ Params: { id: string }; Body: { business_category?: string; profile_description?: string | null } }>('/v1/admin/businesses/:id', {
    onRequest: access.requirePermission('businesses.manage'), schema: { params: params('id'), body: { ...body({ business_category: text(100),
      profile_description: { anyOf: [text(5000), { type: 'null' }] } }), minProperties: 1 } },
  }, async request => db.transaction(async client => {
    const before = (await client.query('SELECT * FROM business_profiles WHERE business_profile_id = $1 FOR UPDATE', [request.params.id])).rows[0];
    if (!before) throw new ApiError(404, 'business_not_found', 'Business was not found');
    const after = (await client.query(`UPDATE business_profiles SET business_category = $2, profile_description = $3
      WHERE business_profile_id = $1 RETURNING *`, [request.params.id, request.body.business_category ?? before.business_category,
      request.body.profile_description === undefined ? before.profile_description : request.body.profile_description])).rows[0]!;
    await audit(client, request, 'businesses.update', 'business_profile', request.params.id, before, after);
    return { business: after };
  }));

  app.post<{ Params: { id: string }; Body: { status: string; note: string } }>('/v1/admin/businesses/:id/publication', {
    onRequest: access.requirePermission('directory.manage'), schema: { params: params('id'), body: body({
      status: { type: 'string', enum: ['draft','published','hidden'] }, note: text(2000) }, ['status','note']) },
  }, async request => db.transaction(async client => {
    const before = (await client.query('SELECT * FROM business_profiles WHERE business_profile_id = $1 FOR UPDATE', [request.params.id])).rows[0];
    if (!before) throw new ApiError(404, 'business_not_found', 'Business was not found');
    const after = (await client.query('UPDATE business_profiles SET profile_status = $2 WHERE business_profile_id = $1 RETURNING *',
      [request.params.id, request.body.status])).rows[0]!;
    await audit(client, request, 'directory.publication', 'business_profile', request.params.id,
      { profile_status: before.profile_status }, { profile_status: after.profile_status, note: request.body.note });
    return { business: after };
  }));
}
