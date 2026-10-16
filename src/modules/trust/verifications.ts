import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import { ApiError } from '../../errors.js';
import { audit, body, evidenceSchema, noSelfReview, ownedEvidence, pagination, params, text, transition, uuid, verificationTransitions, type Page } from './shared.js';

export async function verificationRoutes(app: FastifyInstance, db: Database, access: Authorization) {
  app.post<{ Body: { business_profile_id: string; media_ids: string[] } }>('/v1/verifications', {
    onRequest: access.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: { body: body({ business_profile_id: uuid, media_ids: { ...evidenceSchema, minItems: 1 } }, ['business_profile_id','media_ids']) },
  }, async (request, reply) => {
    const row = await db.transaction(async client => {
      const owner = request.principal!.users_id;
      const profile = (await client.query(`SELECT * FROM business_profiles WHERE business_profile_id = $1
        AND (profile_status = 'published' OR claimed_by_user_id = $2) FOR UPDATE`, [request.body.business_profile_id, owner])).rows[0];
      if (!profile) throw new ApiError(404, 'business_not_found', 'Business was not found');
      if (profile.claimed_by_user_id && profile.claimed_by_user_id !== owner) throw new ApiError(409, 'business_claimed', 'Business is already claimed');
      // Profile lock serializes concurrent submissions without adding a schema constraint.
      if ((await client.query(`SELECT 1 FROM business_verification_requests WHERE business_profile_id = $1
        AND submitted_by_user_id = $2 AND status IN ('pending','in_review')`, [profile.business_profile_id, owner])).rowCount) {
        throw new ApiError(409, 'verification_pending', 'You already have an active request for this business');
      }
      await ownedEvidence(client, owner, request.body.media_ids);
      const row = (await client.query(`INSERT INTO business_verification_requests (business_profile_id,submitted_by_user_id)
        VALUES ($1,$2) RETURNING *`, [profile.business_profile_id, owner])).rows[0]!;
      for (const mediaId of request.body.media_ids) await client.query(`INSERT INTO verification_evidence (verification_request_id,media_id,evidence_type)
        VALUES ($1,$2,'business_claim_document')`, [row.verification_request_id, mediaId]);
      return row;
    });
    return reply.code(201).send({ verification: row });
  });

  app.get<{ Querystring: Page }>('/v1/verifications', { onRequest: access.authenticate, schema: { querystring: pagination } },
    async request => ({ verifications: (await db.query(`SELECT * FROM business_verification_requests WHERE submitted_by_user_id = $1
      ORDER BY submitted_at DESC, verification_request_id DESC LIMIT $2 OFFSET $3`,
    [request.principal!.users_id, request.query.limit ?? 20, request.query.offset ?? 0])).rows }));

  app.get<{ Querystring: Page }>('/v1/admin/verifications', { onRequest: access.requirePermission('verifications.review'), schema: { querystring: pagination } },
    async request => ({ verifications: (await db.query(`SELECT * FROM business_verification_requests
      ORDER BY submitted_at DESC, verification_request_id DESC LIMIT $1 OFFSET $2`, [request.query.limit ?? 20, request.query.offset ?? 0])).rows }));

  app.get<{ Params: { id: string } }>('/v1/verifications/:id', { onRequest: access.authenticate, schema: { params: params('id') } }, async request => {
    const row = (await db.query(`SELECT * FROM business_verification_requests WHERE verification_request_id = $1
      AND (submitted_by_user_id = $2 OR $3::boolean)`, [request.params.id, request.principal!.users_id,
      access.can(request.principal!, 'verifications.review')])).rows[0];
    if (!row) throw new ApiError(404, 'verification_not_found', 'Verification request was not found');
    const evidence = await db.query(`SELECT verification_evidence_id, media_id, evidence_type, created_at
      FROM verification_evidence WHERE verification_request_id = $1 ORDER BY verification_evidence_id`, [request.params.id]);
    return { verification: row, evidence: evidence.rows };
  });

  app.post<{ Params: { id: string } }>('/v1/verifications/:id/withdraw', {
    onRequest: access.authenticate, schema: { params: params('id') },
  }, async request => db.transaction(async client => {
    const row = (await client.query(`SELECT * FROM business_verification_requests WHERE verification_request_id = $1
      AND submitted_by_user_id = $2 FOR UPDATE`, [request.params.id, request.principal!.users_id])).rows[0];
    if (!row) throw new ApiError(404, 'verification_not_found', 'Verification request was not found');
    transition(row.status, 'withdrawn', { pending: ['withdrawn'], in_review: ['withdrawn'] });
    return { verification: (await client.query("UPDATE business_verification_requests SET status = 'withdrawn' WHERE verification_request_id = $1 RETURNING *", [request.params.id])).rows[0] };
  }));

  app.post<{ Params: { id: string }; Body: { status: string; note: string } }>('/v1/admin/verifications/:id/review', {
    onRequest: access.requirePermission('verifications.review'), schema: { params: params('id'), body: body({
      status: { type: 'string', enum: ['in_review','approved','rejected'] }, note: text(2000) }, ['status','note']) },
  }, async request => db.transaction(async client => {
    // Always lock profile before request, matching submission lock order.
    const ref = (await client.query('SELECT business_profile_id FROM business_verification_requests WHERE verification_request_id = $1', [request.params.id])).rows[0];
    if (!ref) throw new ApiError(404, 'verification_not_found', 'Verification request was not found');
    const profile = (await client.query('SELECT * FROM business_profiles WHERE business_profile_id = $1 FOR UPDATE', [ref.business_profile_id])).rows[0];
    if (!profile) throw new ApiError(404, 'business_not_found', 'Business was not found');
    const row = (await client.query('SELECT * FROM business_verification_requests WHERE verification_request_id = $1 FOR UPDATE', [request.params.id])).rows[0];
    if (!row) throw new ApiError(404, 'verification_not_found', 'Verification request was not found');
    noSelfReview(request, row.submitted_by_user_id);
    noSelfReview(request, profile.claimed_by_user_id);
    transition(row.status, request.body.status, verificationTransitions);
    if (request.body.status === 'approved') {
      if (profile.claimed_by_user_id && profile.claimed_by_user_id !== row.submitted_by_user_id) throw new ApiError(409, 'business_claimed', 'Business is already claimed');
      if (!(await client.query('SELECT 1 FROM verification_evidence WHERE verification_request_id = $1', [row.verification_request_id])).rowCount) {
        throw new ApiError(409, 'missing_evidence', 'Approval requires submitted evidence');
      }
      await client.query('UPDATE business_profiles SET claimed_by_user_id = $2 WHERE business_profile_id = $1', [profile.business_profile_id, row.submitted_by_user_id]);
      await audit(client, request, 'businesses.claim', 'business_profile', profile.business_profile_id,
        { claimed_by_user_id: profile.claimed_by_user_id }, { claimed_by_user_id: row.submitted_by_user_id });
    }
    const after = (await client.query(`UPDATE business_verification_requests SET status = $2, reviewed_by_user_id = $3,
      reviewed_at = now(), decision_note = $4 WHERE verification_request_id = $1 RETURNING *`,
    [row.verification_request_id, request.body.status, request.principal!.users_id, request.body.note])).rows[0]!;
    await client.query(`INSERT INTO moderation_actions (moderator_user_id, verification_request_id, action_type, note)
      VALUES ($1,$2,$3,$4)`, [request.principal!.users_id, row.verification_request_id, request.body.status, request.body.note]);
    await audit(client, request, 'verifications.review', 'verification_request', row.verification_request_id, row, after);
    return { verification: after };
  }));
}
