import type { Database, SqlExecutor } from '../../database/index.js';
import { ApiError } from '../../errors.js';
import { normalizeCreate, normalizeIdentifier } from './validation.js';
import type { CreateInvestigation, Investigation, InvestigationJobs } from './types.js';

export const revisionSql = `to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

export async function checkDocuments(client: SqlExecutor, ids: string[], userId: string) {
  if (!ids.length) return;
  // Row locks serialize reference creation with media removal.
  const found = await client.query(`SELECT media_id FROM media_files WHERE media_id = ANY($1::uuid[])
    AND uploaded_by_user_id = $2 AND upload_status = 'ready' AND media_type = 'document'
    AND provider_delivery_type = 'authenticated' AND visibility IN ('private', 'restricted') FOR SHARE`, [ids, userId]);
  if (found.rows.length !== ids.length) throw new ApiError(400, 'invalid_document', 'Documents must be ready, authenticated uploads owned by your account');
}

export async function createInvestigation(db: Database, userId: string, body: CreateInvestigation,
  consume?: (client:SqlExecutor,userId:string,investigationId:string,input:CreateInvestigation)=>Promise<void>) {
  const normalized = normalizeCreate(body);
  return db.transaction(async client => {
    await checkDocuments(client, normalized.input_data.media_ids, userId);
    const inserted = await client.query<Investigation & { dispatch_revision: string }>(`INSERT INTO investigations
      (user_id, investigation_type, title, user_prompt, input_data) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *, ${revisionSql} AS dispatch_revision`,
    [userId, normalized.investigation_type, normalized.title ?? null, normalized.user_prompt, JSON.stringify(normalized.input_data)]);
    const { dispatch_revision: revision, ...investigation } = inserted.rows[0]!;
    if (consume) await consume(client,userId,investigation.investigation_id,normalized);
    for (const [index, target] of normalized.input_data.targets.entries()) {
      const entity = await client.query(`INSERT INTO entities (entity_type, canonical_name) VALUES ($1, $2) RETURNING entity_id`, [target.entity_type, target.canonical_name]);
      const entityId = entity.rows[0]!.entity_id;
      for (const identifier of target.identifiers ?? []) {
        await client.query(`INSERT INTO identifiers (entity_id, identifier_type, value, normalized_value)
          VALUES ($1, $2, $3, $4)`, [entityId, identifier.identifier_type, identifier.value, normalizeIdentifier(identifier)]);
      }
      await client.query(`INSERT INTO investigation_targets (investigation_id, entity_id, target_role, result_rank)
        VALUES ($1, $2, $3, $4)`, [investigation.investigation_id, entityId, target.target_role ?? 'candidate', index + 1]);
    }
    return { investigation, revision };
  });
}

export async function dispatchInvestigation(jobs: InvestigationJobs | undefined, id: string, revision: string): Promise<'queued' | 'deferred'> {
  if (!jobs) return 'deferred';
  try { await jobs.enqueue(id, true, revision); return 'queued'; }
  catch { return 'deferred'; } // The committed DB row is recovered by reconciliation.
}

export async function failCollection(db: Database, id: string, code: string, revision: string) {
  await db.query(`UPDATE investigations SET status = 'failed', error_code = $2, completed_at = now()
    WHERE investigation_id = $1 AND status IN ('queued', 'collecting_sources', 'analyzing')
    AND ${revisionSql} = $3`, [id, code, revision]);
}
