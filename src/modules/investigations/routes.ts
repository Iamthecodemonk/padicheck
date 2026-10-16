import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import { ApiError } from '../../errors.js';
import type { CreateInvestigation, Investigation, InvestigationJobs } from './types.js';
import { createSchema, uuidPattern } from './validation.js';
import { createInvestigation, dispatchInvestigation, revisionSql } from './service.js';

const paramsSchema = { type: 'object', additionalProperties: false, required: ['investigation_id'],
  properties: { investigation_id: { type: 'string', format: 'uuid' } } };
type Params = { investigation_id: string };
type SourceRow = { source_id: string; source_type: string; url: string | null; media_id: string | null; [key: string]: unknown };

export async function investigationRoutes(app: FastifyInstance, db: Database, access: Authorization, jobs?: InvestigationJobs, researchEnabled = false) {
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/v1/investigations')) reply.header('Cache-Control', 'no-store');
    return payload;
  });
  async function readable(id: string, principal: NonNullable<import('fastify').FastifyRequest['principal']>) {
    const all = access.can(principal, 'investigations.read_all');
    if (!all && !access.can(principal, 'investigations.read_own')) throw new ApiError(403, 'forbidden', 'You do not have permission to read investigations');
    const result = await db.query<Investigation>(`SELECT * FROM investigations
      WHERE investigation_id = $1 AND (user_id = $2 OR $3::boolean)`, [id, principal.users_id, all]);
    const row = result.rows[0];
    if (!row) throw new ApiError(404, 'investigation_not_found', 'Investigation was not found');
    return row;
  }
  const capabilities = { independent_search: researchEnabled, ai_analysis: researchEnabled };

  app.post<{ Body: CreateInvestigation }>('/v1/investigations', {
    onRequest: access.requirePermission('investigations.create'),
    bodyLimit: 64 * 1024, schema: { body: createSchema },
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { investigation, revision } = await createInvestigation(db, request.principal!.users_id, request.body);
    const dispatch = await dispatchInvestigation(jobs, investigation.investigation_id, revision);
    if (dispatch === 'deferred') request.log.info({ investigation_id: investigation.investigation_id }, 'Investigation persisted; dispatch deferred');
    return reply.code(202).header('Location', `/v1/investigations/${investigation.investigation_id}`)
      .send({ investigation, dispatch, capabilities });
  });

  app.get<{ Querystring: { scope?: 'own' | 'all'; limit?: number; cursor?: string } }>('/v1/investigations', {
    onRequest: access.authenticate,
    schema: { querystring: { type: 'object', additionalProperties: false, properties: {
      scope: { type: 'string', enum: ['own', 'all'], default: 'own' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      cursor: { type: 'string', maxLength: 300 },
    } } },
  }, async request => {
    const principal = request.principal!;
    const all = request.query.scope === 'all';
    if (all ? !access.can(principal, 'investigations.read_all') :
      !access.can(principal, 'investigations.read_own') && !access.can(principal, 'investigations.read_all')) {
      throw new ApiError(403, 'forbidden', 'You do not have permission for this investigation scope');
    }
    let cursorTime: string | null = null;
    let cursorId: string | null = null;
    if (request.query.cursor) {
      try {
        const parsed = JSON.parse(Buffer.from(request.query.cursor, 'base64url').toString('utf8'));
        if (typeof parsed.time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(parsed.time) ||
            !Number.isFinite(Date.parse(parsed.time)) || new Date(parsed.time).toISOString().slice(0, 19) !== parsed.time.slice(0, 19) ||
            typeof parsed.id !== 'string' || !uuidPattern.test(parsed.id)) throw new Error();
        cursorTime = parsed.time; cursorId = parsed.id;
      } catch { throw new ApiError(400, 'invalid_cursor', 'Pagination cursor is invalid'); }
    }
    const limit = request.query.limit ?? 20;
    const result = await db.query<Investigation & { cursor_time: string }>(`SELECT investigation_id, user_id, investigation_type,
      title, status, error_code, created_at, updated_at, started_at, completed_at,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time
      FROM investigations WHERE (user_id = $1 OR $2::boolean)
      AND ($3::timestamptz IS NULL OR (created_at, investigation_id) < ($3::timestamptz, $4::uuid))
      ORDER BY created_at DESC, investigation_id DESC LIMIT $5`, [principal.users_id, all, cursorTime, cursorId, limit + 1]);
    const rows = result.rows.slice(0, limit);
    const last = rows.at(-1);
    const next = result.rows.length > limit && last ? Buffer.from(JSON.stringify({ time: last.cursor_time, id: last.investigation_id })).toString('base64url') : null;
    return { investigations: rows.map(({ cursor_time: _cursor, ...row }) => row), next_cursor: next };
  });

  app.get<{ Params: Params }>('/v1/investigations/:investigation_id', {
    onRequest: access.authenticate, schema: { params: paramsSchema },
  }, async request => {
    const row = await readable(request.params.investigation_id, request.principal!);
    const targets = await db.query(`SELECT t.investigation_target_id, t.target_role, t.result_rank, t.is_selected,
      e.entity_id, e.entity_type, e.canonical_name,
      COALESCE(jsonb_agg(jsonb_build_object('identifier_id', i.identifier_id, 'identifier_type', i.identifier_type,
        'value', i.value, 'normalized_value', i.normalized_value)) FILTER (WHERE i.identifier_id IS NOT NULL), '[]'::jsonb) AS identifiers
      FROM investigation_targets t JOIN entities e ON e.entity_id = t.entity_id
      LEFT JOIN identifiers i ON i.entity_id = e.entity_id WHERE t.investigation_id = $1
      GROUP BY t.investigation_target_id, e.entity_id ORDER BY t.result_rank, t.investigation_target_id`, [row.investigation_id]);
    const sources = await db.query<SourceRow>(`SELECT s.source_id, s.source_type, s.url, s.media_id FROM sources s
      JOIN investigation_sources link ON link.source_id = s.source_id
      WHERE link.investigation_id = $1 AND link.discovery_method = 'user_submission'`, [row.investigation_id]);
    const urls = row.input_data.urls ?? [];
    const documents = row.input_data.media_ids ?? [];
    const complete = !['queued', 'failed'].includes(row.status) && row.started_at !== null && urls.every(url => sources.rows.some(source => source.source_type === 'user_provided_link' && source.url === url)) &&
      documents.every(id => sources.rows.some(source => source.source_type === 'uploaded_document' && source.media_id === id));
    return { investigation: row, targets: targets.rows, source_collection_complete: complete, capabilities,
      limitations: [researchEnabled ? 'AI-assisted interpretation of available evidence is not verification. Source coverage and model output may be incomplete or wrong.' :
        'Submitted references are not independently verified. Web research and AI analysis are disabled.'] };
  });

  app.get<{ Params: Params; Querystring: { limit?: number; offset?: number } }>('/v1/investigations/:investigation_id/findings', {
    onRequest: access.authenticate, schema: { params: paramsSchema, querystring: { type: 'object', additionalProperties: false,
      properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 } } } },
  }, async request => {
    await readable(request.params.investigation_id, request.principal!);
    const result = await db.query(`SELECT f.*, COALESCE(jsonb_agg(jsonb_build_object('source_id', s.source_id,
      'url', s.url, 'media_id', s.media_id, 'title', s.title, 'support_type', link.support_type, 'evidence_note', link.evidence_note))
      FILTER (WHERE s.source_id IS NOT NULL), '[]'::jsonb) AS sources
      FROM findings f LEFT JOIN finding_sources link ON link.finding_id = f.finding_id LEFT JOIN sources s ON s.source_id = link.source_id
      WHERE f.investigation_id = $1 GROUP BY f.finding_id ORDER BY f.display_order, f.finding_id LIMIT $2 OFFSET $3`,
    [request.params.investigation_id, request.query.limit ?? 20, request.query.offset ?? 0]);
    return { findings: result.rows, limitations: ['AI-generated findings remain unverified; review the linked evidence and source coverage.'] };
  });

  app.get<{ Params: Params; Querystring: { limit?: number; offset?: number } }>('/v1/investigations/:investigation_id/model-runs', {
    onRequest: access.authenticate, schema: { params: paramsSchema, querystring: { type: 'object', additionalProperties: false,
      properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 } } } },
  }, async request => {
    await readable(request.params.investigation_id, request.principal!);
    const result = await db.query(`SELECT model_run_id, task_type, provider, model_name, prompt_version, status,
      input_tokens, output_tokens, estimated_cost_usd, error_code, started_at, completed_at, created_at
      FROM model_runs WHERE investigation_id = $1 ORDER BY created_at DESC, model_run_id DESC LIMIT $2 OFFSET $3`,
    [request.params.investigation_id, request.query.limit ?? 20, request.query.offset ?? 0]);
    return { model_runs: result.rows };
  });

  app.get<{ Params: Params; Querystring: { limit?: number; offset?: number } }>('/v1/investigations/:investigation_id/sources', {
    onRequest: access.authenticate, schema: { params: paramsSchema,
      querystring: { type: 'object', additionalProperties: false, properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 },
      } } },
  }, async request => {
    await readable(request.params.investigation_id, request.principal!);
    const result = await db.query(`SELECT s.source_id, s.source_type, s.url, s.media_id, s.title, s.publisher, s.excerpt,
      s.content_hash, s.fetched_at, s.visibility, s.metadata, s.created_at,
      link.discovery_method, link.relevance_rank, link.used_in_analysis, link.added_at
      FROM investigation_sources link JOIN sources s ON s.source_id = link.source_id
      WHERE link.investigation_id = $1 ORDER BY link.relevance_rank NULLS LAST, s.source_id LIMIT $2 OFFSET $3`,
    [request.params.investigation_id, request.query.limit ?? 20, request.query.offset ?? 0]);
    return { sources: result.rows, capabilities };
  });

  for (const action of ['cancel', 'retry'] as const) {
    app.post<{ Params: Params }>(`/v1/investigations/:investigation_id/${action}`, {
      onRequest: access.requirePermission('investigations.create'), schema: { params: paramsSchema },
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const result = await db.transaction(async client => {
        const found = await client.query<Investigation>('SELECT * FROM investigations WHERE investigation_id = $1 AND user_id = $2 FOR UPDATE',
          [request.params.investigation_id, request.principal!.users_id]);
        const row = found.rows[0];
        if (!row) throw new ApiError(404, 'investigation_not_found', 'Investigation was not found');
        if (action === 'cancel') {
          if (row.status === 'cancelled') return { row, revision: '' };
          if (!['queued', 'collecting_sources', 'analyzing'].includes(row.status)) throw new ApiError(409, 'invalid_transition', 'Only active investigations can be cancelled');
          return { row: (await client.query<Investigation>(`UPDATE investigations SET status = 'cancelled',
            completed_at = now(), error_code = NULL WHERE investigation_id = $1 RETURNING *`, [row.investigation_id])).rows[0]!, revision: '' };
        }
        if (row.status !== 'failed') throw new ApiError(409, 'invalid_transition', 'Only failed investigations can be retried');
        const updated = (await client.query<Investigation & { dispatch_revision: string }>(`UPDATE investigations SET status = 'queued', error_code = NULL,
          started_at = NULL, completed_at = NULL, result_summary = NULL WHERE investigation_id = $1 RETURNING *, ${revisionSql} AS dispatch_revision`, [row.investigation_id])).rows[0]!;
        const { dispatch_revision: revision, ...retried } = updated;
        return { row: retried, revision };
      });
      const dispatch = action === 'retry' ? await dispatchInvestigation(jobs, result.row.investigation_id, result.revision) : undefined;
      return reply.code(action === 'retry' ? 202 : 200).send({ investigation: result.row, ...(dispatch ? { dispatch } : {}) });
    });
  }
}
