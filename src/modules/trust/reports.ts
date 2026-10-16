import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import { ApiError } from '../../errors.js';
import { audit, body, evidenceSchema, noBusinessConflict, noSelfReview, ownedEvidence, pagination, params, reportTransitions, text, transition, uuid, type Page } from './shared.js';

export async function reportRoutes(app: FastifyInstance, db: Database, access: Authorization) {
  app.post<{ Body: { entity_id: string; report_category: string; title: string; description: string; incident_at?: string; media_ids?: string[] } }>('/v1/reports', {
    onRequest: access.requirePermission('reports.submit'), bodyLimit: 32 * 1024,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, schema: { body: body({
      entity_id: uuid, report_category: text(100), title: text(200), description: text(10000),
      incident_at: { type: 'string', format: 'date-time' }, media_ids: evidenceSchema,
    }, ['entity_id','report_category','title','description']) },
  }, async (request, reply) => {
    const row = await db.transaction(async client => {
      const input = request.body;
      // Knowledge of an arbitrary private entity UUID must not allow attaching allegations to it.
      const found = await client.query(`SELECT e.entity_id FROM entities e WHERE e.entity_id = $1 AND (
        EXISTS (SELECT 1 FROM business_profiles b WHERE b.entity_id = e.entity_id AND b.profile_status = 'published') OR
        EXISTS (SELECT 1 FROM investigation_targets t JOIN investigations i ON i.investigation_id = t.investigation_id
          WHERE t.entity_id = e.entity_id AND i.user_id = $2)) FOR SHARE OF e`, [input.entity_id, request.principal!.users_id]);
      if (!found.rowCount) throw new ApiError(404, 'entity_not_found', 'Entity was not found');
      await ownedEvidence(client, request.principal!.users_id, input.media_ids ?? []);
      const row = (await client.query(`INSERT INTO user_reports (entity_id,submitted_by_user_id,report_category,title,description,incident_at)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [input.entity_id, request.principal!.users_id, input.report_category, input.title, input.description, input.incident_at ?? null])).rows[0]!;
      for (const mediaId of input.media_ids ?? []) await client.query('INSERT INTO user_report_evidence (user_report_id,media_id) VALUES ($1,$2)', [row.user_report_id, mediaId]);
      return row;
    });
    return reply.code(201).send({ report: row });
  });

  app.get<{ Querystring: Page }>('/v1/reports', { onRequest: access.authenticate, schema: { querystring: pagination } }, async request => ({
    reports: (await db.query(`SELECT * FROM user_reports WHERE submitted_by_user_id = $1
      ORDER BY submitted_at DESC, user_report_id DESC LIMIT $2 OFFSET $3`, [request.principal!.users_id, request.query.limit ?? 20, request.query.offset ?? 0])).rows,
  }));
  app.get<{ Querystring: Page }>('/v1/admin/reports', { onRequest: access.requirePermission('reports.moderate'), schema: { querystring: pagination } }, async request => ({
    reports: (await db.query('SELECT * FROM user_reports ORDER BY submitted_at DESC, user_report_id DESC LIMIT $1 OFFSET $2', [request.query.limit ?? 20, request.query.offset ?? 0])).rows,
  }));

  app.get<{ Params: { id: string }; Querystring: Page }>('/v1/directory/:id/reports', {
    schema: { params: params('id'), querystring: pagination },
  }, async request => {
    const profile = (await db.query("SELECT entity_id FROM business_profiles WHERE business_profile_id = $1 AND profile_status = 'published'", [request.params.id])).rows[0];
    if (!profile) throw new ApiError(404, 'business_not_found', 'Business was not found');
    return { reports: (await db.query(`SELECT user_report_id, entity_id, report_category, title, description, incident_at, submitted_at,
      EXISTS (SELECT 1 FROM report_disputes d WHERE d.user_report_id = r.user_report_id AND d.status IN ('submitted','under_review')) AS is_disputed
      FROM user_reports r WHERE entity_id = $1 AND status = 'published' ORDER BY submitted_at DESC, user_report_id DESC LIMIT $2 OFFSET $3`,
    [profile.entity_id, request.query.limit ?? 20, request.query.offset ?? 0])).rows,
    limitations: ['These are moderated user-submitted allegations, not verified facts or AI findings.'] };
  });

  app.get<{ Params: { id: string } }>('/v1/reports/:id', { onRequest: access.authenticate, schema: { params: params('id') } }, async request => {
    const row = (await db.query(`SELECT * FROM user_reports WHERE user_report_id = $1 AND (submitted_by_user_id = $2 OR $3::boolean)`,
      [request.params.id, request.principal!.users_id, access.can(request.principal!, 'reports.moderate') || access.can(request.principal!, 'disputes.resolve')])).rows[0];
    if (!row) throw new ApiError(404, 'report_not_found', 'Report was not found');
    return { report: row, evidence: (await db.query(`SELECT report_evidence_id, media_id, evidence_note, created_at
      FROM user_report_evidence WHERE user_report_id = $1 ORDER BY report_evidence_id`, [row.user_report_id])).rows };
  });

  app.post<{ Params: { id: string } }>('/v1/reports/:id/withdraw', { onRequest: access.authenticate, schema: { params: params('id') } },
    async request => db.transaction(async client => {
      const row = (await client.query('SELECT * FROM user_reports WHERE user_report_id = $1 AND submitted_by_user_id = $2 FOR UPDATE',
        [request.params.id, request.principal!.users_id])).rows[0];
      if (!row) throw new ApiError(404, 'report_not_found', 'Report was not found');
      transition(row.status, 'withdrawn', { submitted: ['withdrawn'], under_review: ['withdrawn'], published: ['withdrawn'] });
      return { report: (await client.query("UPDATE user_reports SET status = 'withdrawn' WHERE user_report_id = $1 RETURNING *", [request.params.id])).rows[0] };
    }));

  app.post<{ Params: { id: string }; Body: { status: string; note: string } }>('/v1/admin/reports/:id/review', {
    onRequest: access.requirePermission('reports.moderate'), schema: { params: params('id'), body: body({
      status: { type: 'string', enum: ['under_review','published','rejected'] }, note: text(2000) }, ['status','note']) },
  }, async request => db.transaction(async client => {
    const row = (await client.query('SELECT * FROM user_reports WHERE user_report_id = $1 FOR UPDATE', [request.params.id])).rows[0];
    if (!row) throw new ApiError(404, 'report_not_found', 'Report was not found');
    noSelfReview(request, row.submitted_by_user_id);
    // A claimed business owner must not moderate allegations about their own business.
    await noBusinessConflict(client, row.entity_id, request.principal!.users_id);
    transition(row.status, request.body.status, reportTransitions);
    const after = (await client.query(`UPDATE user_reports SET status = $2, reviewed_at = now(), reviewed_by_user_id = $3,
      moderation_note = $4 WHERE user_report_id = $1 RETURNING *`, [row.user_report_id, request.body.status, request.principal!.users_id, request.body.note])).rows[0]!;
    await client.query(`INSERT INTO moderation_actions (moderator_user_id,user_report_id,action_type,note) VALUES ($1,$2,$3,$4)`,
      [request.principal!.users_id, row.user_report_id, request.body.status, request.body.note]);
    await audit(client, request, 'reports.review', 'user_report', row.user_report_id, row, after);
    return { report: after };
  }));
}
