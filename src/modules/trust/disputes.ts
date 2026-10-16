import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import { ApiError } from '../../errors.js';
import { audit, body, disputeTransitions, noBusinessConflict, noSelfReview, pagination, params, text, transition, type Page } from './shared.js';

export async function disputeRoutes(app: FastifyInstance, db: Database, access: Authorization) {
  app.post<{ Params: { id: string }; Body: { reason: string } }>('/v1/reports/:id/disputes', {
    onRequest: access.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: { params: params('id'), body: body({ reason: text(5000) }, ['reason']) },
  }, async (request, reply) => {
    const row = await db.transaction(async client => {
      const report = (await client.query(`SELECT r.* FROM user_reports r WHERE r.user_report_id = $1 AND (
        r.submitted_by_user_id = $2 OR (r.status = 'published' AND EXISTS (SELECT 1 FROM business_profiles b
          WHERE b.entity_id = r.entity_id AND b.profile_status = 'published'))) FOR UPDATE OF r`, [request.params.id, request.principal!.users_id])).rows[0];
      if (!report) throw new ApiError(404, 'report_not_found', 'Report was not found');
      if (report.status !== 'published') throw new ApiError(409, 'report_not_published', 'Only published reports can be disputed');
      if ((await client.query(`SELECT 1 FROM report_disputes WHERE user_report_id = $1 AND filed_by_user_id = $2
        AND status IN ('submitted','under_review')`, [report.user_report_id, request.principal!.users_id])).rowCount) {
        throw new ApiError(409, 'dispute_pending', 'You already have an active dispute for this report');
      }
      return (await client.query('INSERT INTO report_disputes (user_report_id,filed_by_user_id,reason) VALUES ($1,$2,$3) RETURNING *',
        [report.user_report_id, request.principal!.users_id, request.body.reason])).rows[0]!;
    });
    return reply.code(201).send({ dispute: row });
  });

  app.get<{ Querystring: Page }>('/v1/disputes', { onRequest: access.authenticate, schema: { querystring: pagination } }, async request => ({
    disputes: (await db.query(`SELECT * FROM report_disputes WHERE filed_by_user_id = $1
      ORDER BY created_at DESC, dispute_id DESC LIMIT $2 OFFSET $3`, [request.principal!.users_id, request.query.limit ?? 20, request.query.offset ?? 0])).rows,
  }));
  app.get<{ Querystring: Page }>('/v1/admin/disputes', { onRequest: access.requirePermission('disputes.resolve'), schema: { querystring: pagination } }, async request => ({
    disputes: (await db.query('SELECT * FROM report_disputes ORDER BY created_at DESC, dispute_id DESC LIMIT $1 OFFSET $2', [request.query.limit ?? 20, request.query.offset ?? 0])).rows,
  }));
  app.get<{ Params: { id: string } }>('/v1/disputes/:id', { onRequest: access.authenticate, schema: { params: params('id') } }, async request => {
    const row = (await db.query(`SELECT * FROM report_disputes WHERE dispute_id = $1 AND (filed_by_user_id = $2 OR $3::boolean)`,
      [request.params.id, request.principal!.users_id, access.can(request.principal!, 'disputes.resolve')])).rows[0];
    if (!row) throw new ApiError(404, 'dispute_not_found', 'Dispute was not found');
    return { dispute: row };
  });
  app.post<{ Params: { id: string } }>('/v1/disputes/:id/withdraw', { onRequest: access.authenticate, schema: { params: params('id') } },
    async request => db.transaction(async client => {
      const row = (await client.query('SELECT * FROM report_disputes WHERE dispute_id = $1 AND filed_by_user_id = $2 FOR UPDATE',
        [request.params.id, request.principal!.users_id])).rows[0];
      if (!row) throw new ApiError(404, 'dispute_not_found', 'Dispute was not found');
      transition(row.status, 'withdrawn', { submitted: ['withdrawn'], under_review: ['withdrawn'] });
      return { dispute: (await client.query("UPDATE report_disputes SET status = 'withdrawn' WHERE dispute_id = $1 RETURNING *", [row.dispute_id])).rows[0] };
    }));

  app.post<{ Params: { id: string }; Body: { status: string; note: string; report_action?: 'keep' | 'unpublish' } }>('/v1/admin/disputes/:id/review', {
    onRequest: access.requirePermission('disputes.resolve'), schema: { params: params('id'), body: body({
      status: { type: 'string', enum: ['under_review','resolved','rejected'] }, note: text(2000),
      report_action: { type: 'string', enum: ['keep','unpublish'] },
    }, ['status','note']) },
  }, async request => db.transaction(async client => {
    if (request.body.status !== 'resolved' && request.body.report_action !== undefined ||
      request.body.status === 'resolved' && request.body.report_action === undefined) {
      throw new ApiError(400, 'invalid_resolution', 'A resolved dispute requires an explicit report_action; other statuses must omit it');
    }
    // Serialize with moderation and submission; all paths lock report before dispute.
    const ref = (await client.query('SELECT user_report_id FROM report_disputes WHERE dispute_id = $1', [request.params.id])).rows[0];
    if (!ref) throw new ApiError(404, 'dispute_not_found', 'Dispute was not found');
    const report = (await client.query('SELECT * FROM user_reports WHERE user_report_id = $1 FOR UPDATE', [ref.user_report_id])).rows[0];
    if (!report) throw new ApiError(404, 'report_not_found', 'Report was not found');
    const row = (await client.query('SELECT * FROM report_disputes WHERE dispute_id = $1 FOR UPDATE', [request.params.id])).rows[0];
    if (!row) throw new ApiError(404, 'dispute_not_found', 'Dispute was not found');
    noSelfReview(request, row.filed_by_user_id); noSelfReview(request, report.submitted_by_user_id);
    await noBusinessConflict(client, report.entity_id, request.principal!.users_id);
    transition(row.status, request.body.status, disputeTransitions);
    if (request.body.report_action === 'unpublish') {
      if (!access.can(request.principal!, 'reports.moderate')) throw new ApiError(403, 'forbidden', 'Removing publication requires reports.moderate');
      if (report.status !== 'published') throw new ApiError(409, 'report_not_published', 'Report is no longer published');
      const after = (await client.query(`UPDATE user_reports SET status = 'under_review', reviewed_at = now(), reviewed_by_user_id = $2,
        moderation_note = $3 WHERE user_report_id = $1 RETURNING *`, [report.user_report_id, request.principal!.users_id, request.body.note])).rows[0]!;
      await client.query(`INSERT INTO moderation_actions (moderator_user_id,user_report_id,action_type,note)
        VALUES ($1,$2,'dispute_unpublish',$3)`, [request.principal!.users_id, report.user_report_id, request.body.note]);
      await audit(client, request, 'reports.dispute_unpublish', 'user_report', report.user_report_id, report, after);
    }
    const after = (await client.query(`UPDATE report_disputes SET status = $2, reviewer_user_id = $3, decision_note = $4,
      resolved_at = CASE WHEN $2 IN ('resolved','rejected') THEN now() ELSE NULL END WHERE dispute_id = $1 RETURNING *`,
    [row.dispute_id, request.body.status, request.principal!.users_id, request.body.note])).rows[0]!;
    await audit(client, request, 'disputes.review', 'report_dispute', row.dispute_id, row, { ...after, report_action: request.body.report_action ?? null });
    return { dispute: after };
  }));
}
