import type { Database, SqlExecutor } from '../../database/index.js';
import type { Investigation } from '../investigations/types.js';
import { researchAssignments, permittedTools } from './registry.js';
import { validateAnalysis } from './output.js';
import { hashContent } from '../../adapters/research.js';
import { ResearchError, type ResearchAdapters, type Evidence, type Assignment, type ModelResult } from './types.js';

const activeStatuses = ['collecting_sources', 'analyzing'];
type Source = { source_id: string; source_type: string; url: string | null; media_id: string | null; excerpt: string | null;
  title: string | null; metadata: Record<string, unknown> };

export async function researchOwner(client: SqlExecutor, id: string) {
  const found = await client.query<Investigation>('SELECT * FROM investigations WHERE investigation_id = $1 FOR UPDATE', [id]);
  const row = found.rows[0];
  if (!row || !activeStatuses.includes(row.status)) throw new ResearchError('processing_stopped');
  const owner = await client.query(`SELECT u.users_id FROM users u WHERE u.users_id = $1 AND u.account_status = 'active'
    AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
      JOIN role_permissions rp ON rp.role_id = r.role_id JOIN permissions p ON p.permission_id = rp.permission_id
      WHERE ur.users_id = u.users_id AND (p.permission_key = 'investigations.create' OR (r.role_key = 'superadmin' AND p.permission_key = '*')))
    FOR SHARE`, [row.user_id]);
  if (!owner.rowCount) throw new ResearchError('account_or_permission_unavailable');
  return row;
}

function sessionDatabase(client: SqlExecutor): Database {
  return { query: (sql, values) => client.query(sql, values), session: work => work(client), async close() {},
    async transaction(work) {
      await client.query('BEGIN');
      try { const result = await work(client); await client.query('COMMIT'); return result; }
      catch (error) { await client.query('ROLLBACK'); throw error; }
    } };
}

const errorCode = (error: unknown) => error instanceof ResearchError ? error.code : 'research_processing_failed';
const tokenCount = (value: number | undefined) => value !== undefined && Number.isSafeInteger(value) && value >= 0 && value <= 2147483647 ? value : null;
function cost(assignment: Assignment, result?: ModelResult) {
  const input = assignment.model_config.input_usd_per_million;
  const output = assignment.model_config.output_usd_per_million;
  if (typeof input !== 'number' || typeof output !== 'number' || !Number.isFinite(input + output) || input < 0 || output < 0 ||
      tokenCount(result?.inputTokens) === null || tokenCount(result?.outputTokens) === null) return null;
  const estimate = (result!.inputTokens! * input + result!.outputTokens! * output) / 1000000;
  return estimate <= 999999.999999 ? estimate.toFixed(6) : null;
}

export async function runResearch(db: Database, id: string, adapters: ResearchAdapters) {
  return db.session(async session => {
    const lock = await session.query<{ acquired: boolean }>('SELECT pg_try_advisory_lock(hashtextextended($1, 73)) AS acquired', [id]);
    if (!lock.rows[0]?.acquired) return { outcome: 'ignored' as const };
    const work = sessionDatabase(session);
    try {
      const row = await work.transaction(client => researchOwner(client, id));
      const assignments = await researchAssignments(work);
      if (!assignments.length) throw new ResearchError('analysis_not_configured');
      const primary = assignments[0]!;
      if (row.status === 'collecting_sources') await enrichSources(work, row, primary, adapters);
      const evidence = (await work.query<Evidence>(`SELECT s.source_id, s.source_type, s.title, s.url,
        left(s.excerpt, 8000) AS excerpt, s.metadata->>'content_kind' AS content_kind
        FROM investigation_sources link JOIN sources s ON s.source_id = link.source_id
        WHERE link.investigation_id = $1 AND s.excerpt IS NOT NULL AND length(trim(s.excerpt)) > 0
        ORDER BY CASE WHEN s.source_type = 'uploaded_document' THEN 0 ELSE 1 END,
          link.relevance_rank NULLS LAST, s.source_id LIMIT 12`, [id])).rows;
      if (!evidence.length) throw new ResearchError('no_readable_evidence');
      await work.transaction(async client => {
        await researchOwner(client, id);
        await client.query("UPDATE investigations SET status = 'analyzing' WHERE investigation_id = $1", [id]);
        // A worker crash can leave a running record. Its result is unknown; do
        // not silently claim success or discard the execution history.
        await client.query(`UPDATE model_runs SET status = 'failed', error_code = 'worker_interrupted', completed_at = now()
          WHERE investigation_id = $1 AND status IN ('queued', 'running')`, [id]);
      });
      for (const assignment of assignments) {
        const stillEnabled = (await researchAssignments(work)).some(current => current.assignment_id === assignment.assignment_id);
        if (!stillEnabled) continue;
        const run = await work.transaction(async client => {
          await researchOwner(client, id);
          return (await client.query<{ model_run_id: string }>(`INSERT INTO model_runs (investigation_id, task_id, assignment_id,
            agent_id, model_id, task_type, provider, model_name, prompt_version, status, started_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'running',now()) RETURNING model_run_id`,
          [id, assignment.task_id, assignment.assignment_id, assignment.agent_id, assignment.model_id,
            assignment.task_code, assignment.provider_code, assignment.provider_model_id, assignment.prompt_version])).rows[0]!.model_run_id;
        });
        let result: ModelResult | undefined;
        try {
          result = await adapters.analyze(assignment, row.user_prompt, evidence);
          const output = validateAnalysis(result.output, evidence);
          await work.transaction(async client => {
            await researchOwner(client, id);
            if (!(await researchAssignments(work)).some(current => current.assignment_id === assignment.assignment_id)) throw new ResearchError('routing_disabled');
            for (const [index, finding] of output.findings.entries()) {
              const created = await client.query<{ finding_id: string }>(`INSERT INTO findings (investigation_id, model_run_id,
                finding_type, category, title, explanation, confidence, verification_status, display_order)
                VALUES ($1,$2,$3,$4,$5,$6,$7,'unverified',$8) RETURNING finding_id`,
              [id, run, finding.finding_type, finding.category, finding.title, finding.explanation, finding.confidence, index]);
              for (const supporting of finding.evidence) await client.query(`INSERT INTO finding_sources
                (finding_id, source_id, support_type, evidence_note) VALUES ($1,$2,$3,$4)`,
              [created.rows[0]!.finding_id, supporting.source_id, supporting.support_type, supporting.quote]);
            }
            await client.query(`UPDATE investigation_sources SET used_in_analysis = true
              WHERE investigation_id = $1 AND source_id = ANY($2::uuid[])`, [id, evidence.map(source => source.source_id)]);
            await client.query(`UPDATE model_runs SET status = 'succeeded', provider_request_id = $2,
              input_tokens = $3, output_tokens = $4, estimated_cost_usd = $5, completed_at = now() WHERE model_run_id = $1`,
            [run, result!.requestId ?? null, tokenCount(result!.inputTokens), tokenCount(result!.outputTokens), cost(assignment, result)]);
            await client.query(`UPDATE investigations SET status = 'completed', result_summary = $2,
              completed_at = now(), error_code = NULL WHERE investigation_id = $1`,
            [id, `AI-assisted interpretation of available evidence; not independent verification.\n\n${output.summary}\n\nLimitations: ${output.limitations.join(' ')}`]);
          });
          return { outcome: 'completed' as const };
        } catch (error) {
          const code = errorCode(error);
          await work.query(`UPDATE model_runs SET status = 'failed', error_code = $2, provider_request_id = $3,
            input_tokens = $4, output_tokens = $5, estimated_cost_usd = $6, completed_at = now()
            WHERE model_run_id = $1 AND status = 'running'`,
          [run, code, result?.requestId ?? null, tokenCount(result?.inputTokens), tokenCount(result?.outputTokens), cost(assignment, result)]);
          if (['processing_stopped', 'account_or_permission_unavailable'].includes(code)) throw error;
        }
      }
      throw new ResearchError('analysis_failed');
    } catch (error) {
      const code = errorCode(error);
      if (code === 'processing_stopped') return { outcome: 'ignored' as const };
      await work.query(`UPDATE investigations SET status = 'failed', error_code = $2, completed_at = now()
        WHERE investigation_id = $1 AND status IN ('collecting_sources', 'analyzing')`, [id, code]);
      return { outcome: 'failed' as const, error_code: code };
    } finally { await session.query('SELECT pg_advisory_unlock(hashtextextended($1, 73))', [id]); }
  });
}

async function enrichSources(db: Database, row: Investigation, assignment: Assignment, adapters: ResearchAdapters) {
  const tools = await permittedTools(db, assignment.agent_id);
  if (row.investigation_type !== 'contract_review') {
    const searchTool = tools.get('ultrasearch_search');
    const count = Number(searchTool.tool_config.max_results ?? 5);
    if (!Number.isInteger(count) || count < 1 || count > 5) throw new ResearchError('invalid_tool_configuration');
    const previous = await db.query(`SELECT 1 FROM sources s JOIN investigation_sources link ON link.source_id = s.source_id
      WHERE link.investigation_id = $1 AND link.discovery_method = 'web_search' LIMIT 1`, [row.investigation_id]);
    if (!previous.rowCount) {
      await db.transaction(client => researchOwner(client, row.investigation_id));
      (await permittedTools(db, assignment.agent_id)).get('ultrasearch_search');
      const names = (row.input_data.targets ?? []).map(target => [target.canonical_name,
        ...(target.identifiers ?? []).filter(identifier => ['domain', 'phone', 'registration_number'].includes(identifier.identifier_type)).map(identifier => identifier.value)].join(' ')).join(' ');
      const results = await adapters.search((names || row.user_prompt).slice(0, 500), count, searchTool.credential_secret_ref);
      await db.transaction(async client => {
        await researchOwner(client, row.investigation_id);
        for (const [index, result] of results.entries()) {
          const existing = await client.query(`SELECT 1 FROM sources s JOIN investigation_sources link ON link.source_id = s.source_id
            WHERE link.investigation_id = $1 AND s.url = $2`, [row.investigation_id, result.url]);
          if (existing.rowCount) continue;
          const source = await client.query<{ source_id: string }>(`INSERT INTO sources (source_type, url, title, excerpt, visibility, metadata)
            VALUES ('web_page',$1,$2,$3,'private','{"origin":"ultrasearch","content_kind":"search_snippet","content_retrieved":false}'::jsonb) RETURNING source_id`,
          [result.url, result.title || null, result.snippet || null]);
          await client.query(`INSERT INTO investigation_sources (investigation_id, source_id, discovery_method, relevance_rank, used_in_analysis)
            VALUES ($1,$2,'web_search',$3,false)`, [row.investigation_id, source.rows[0]!.source_id, index + 1]);
        }
      });
    }
  }
  const sources = await db.query<Source>(`SELECT s.* FROM investigation_sources link JOIN sources s ON s.source_id = link.source_id
    WHERE link.investigation_id = $1 ORDER BY CASE WHEN s.source_type = 'uploaded_document' THEN 0 ELSE 1 END, link.relevance_rank NULLS LAST, s.source_id LIMIT 25`, [row.investigation_id]);
  for (const source of sources.rows) {
    if (source.metadata.content_retrieved === true) continue;
    await db.transaction(client => researchOwner(client, row.investigation_id));
    try {
      let excerpt: string;
      let title = source.title;
      let metadata: Record<string, unknown>;
      if (source.source_type === 'uploaded_document' && source.media_id) {
        (await permittedTools(db, assignment.agent_id)).get('pdf_extract');
        const media = (await db.query<{ provider_public_id: string; sha256: string | null }>(`SELECT provider_public_id, sha256 FROM media_files
          WHERE media_id = $1 AND uploaded_by_user_id = $2 AND upload_status = 'ready' AND media_type = 'document'
          AND storage_provider = 'cloudinary' AND provider_resource_type = 'raw' AND provider_delivery_type = 'authenticated'`, [source.media_id, row.user_id])).rows[0];
        if (!media) throw new ResearchError('invalid_document');
        const bytes = await adapters.downloadDocument(media.provider_public_id);
        if (media.sha256 && hashContent(bytes) !== media.sha256) throw new ResearchError('document_hash_mismatch');
        const document = await adapters.extractPdf(bytes);
        excerpt = document.text; metadata = { content_kind: 'pdf_text', pages: document.pages, truncated: document.truncated };
      } else if (source.url) {
        (await permittedTools(db, assignment.agent_id)).get('public_url_fetch');
        const page = await adapters.fetchPage(source.url);
        excerpt = page.text; title = page.title || title;
        metadata = { content_kind: 'web_page', resolved_url: page.url, truncated: page.truncated };
      } else continue;
      await db.transaction(async client => {
        await researchOwner(client, row.investigation_id);
        await client.query(`UPDATE sources SET title = $2, excerpt = $3, content_hash = $4, fetched_at = now(),
          metadata = (metadata - 'fetch_error') || $5::jsonb WHERE source_id = $1`,
        [source.source_id, title, excerpt.slice(0, 16000), hashContent(excerpt), JSON.stringify({ ...metadata, content_retrieved: true })]);
      });
    } catch (error) {
      const code = errorCode(error);
      if (['processing_stopped', 'account_or_permission_unavailable', 'required_tool_unconfigured'].includes(code)) throw error;
      await db.transaction(async client => {
        await researchOwner(client, row.investigation_id);
        await client.query("UPDATE sources SET metadata = metadata || $2::jsonb WHERE source_id = $1", [source.source_id, JSON.stringify({ fetch_error: code })]);
      });
    }
  }
}
