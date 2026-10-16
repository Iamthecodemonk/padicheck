import type { Database } from '../../database/index.js';
import { ApiError } from '../../errors.js';
import type { Investigation } from './types.js';
import { normalizeCreate, uuidPattern } from './validation.js';
import { checkDocuments } from './service.js';

export type CollectionOutcome = { outcome: 'collected' | 'ignored' | 'failed'; error_code?: string };

export async function collectSubmittedSources(db: Database, id: string): Promise<CollectionOutcome> {
  if (!uuidPattern.test(id)) throw new Error('Invalid investigation job identifier');
  return db.transaction(async client => {
    // Serialize duplicate deliveries with each other and with cancellation.
    const result = await client.query<Investigation>('SELECT * FROM investigations WHERE investigation_id = $1 FOR UPDATE', [id]);
    const row = result.rows[0];
    if (!row || !['queued', 'collecting_sources'].includes(row.status)) return { outcome: 'ignored' };
    async function failed(code: string): Promise<CollectionOutcome> {
      await client.query(`UPDATE investigations SET status = 'failed', error_code = $2,
        started_at = COALESCE(started_at, now()), completed_at = now() WHERE investigation_id = $1`, [id, code]);
      return { outcome: 'failed', error_code: code };
    }
    const user = await client.query("SELECT users_id FROM users WHERE users_id = $1 AND account_status = 'active' FOR SHARE", [row.user_id]);
    if (!user.rowCount) return failed('account_unavailable');
    const permission = await client.query(`SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
      JOIN role_permissions rp ON rp.role_id = r.role_id JOIN permissions p ON p.permission_id = rp.permission_id
      WHERE ur.users_id = $1 AND (p.permission_key = 'investigations.create' OR (r.role_key = 'superadmin' AND p.permission_key = '*')) LIMIT 1`, [row.user_id]);
    if (!permission.rowCount) return failed('permission_revoked');
    let input;
    try {
      input = normalizeCreate({ investigation_type: row.investigation_type, user_prompt: row.user_prompt, input_data: row.input_data }).input_data;
      if (input.urls.length > 10 || input.media_ids.length > 10 || input.media_ids.some(mediaId => !uuidPattern.test(mediaId))) return failed('invalid_input');
      await checkDocuments(client, input.media_ids, row.user_id);
    } catch (error) {
      if (error instanceof ApiError) return failed(error.code);
      // Malformed persisted JSON is a deterministic input failure, not a job retry.
      if (error instanceof TypeError) return failed('invalid_input');
      throw error;
    }
    await client.query(`UPDATE investigations SET status = 'collecting_sources',
      started_at = COALESCE(started_at, now()), error_code = NULL WHERE investigation_id = $1`, [id]);
    let rank = 0;
    for (const url of input.urls) {
      rank++;
      const existing = await client.query(`SELECT 1 FROM investigation_sources link JOIN sources s ON s.source_id = link.source_id
        WHERE link.investigation_id = $1 AND s.source_type = 'user_provided_link' AND s.url = $2`, [id, url]);
      if (existing.rowCount) continue;
      const source = await client.query(`INSERT INTO sources (source_type, url, visibility, metadata)
        VALUES ('user_provided_link', $1, 'private', '{"origin":"user_submission","content_retrieved":false}'::jsonb) RETURNING source_id`, [url]);
      await client.query(`INSERT INTO investigation_sources (investigation_id, source_id, discovery_method, relevance_rank, used_in_analysis)
        VALUES ($1, $2, 'user_submission', $3, false)`, [id, source.rows[0]!.source_id, rank]);
    }
    for (const mediaId of input.media_ids) {
      rank++;
      const existing = await client.query(`SELECT 1 FROM investigation_sources link JOIN sources s ON s.source_id = link.source_id
        WHERE link.investigation_id = $1 AND s.source_type = 'uploaded_document' AND s.media_id = $2`, [id, mediaId]);
      if (existing.rowCount) continue;
      const source = await client.query(`INSERT INTO sources (source_type, media_id, content_hash, visibility, metadata)
        SELECT 'uploaded_document', media_id, sha256, 'private', '{"origin":"user_submission","content_retrieved":false}'::jsonb
        FROM media_files WHERE media_id = $1 RETURNING source_id`, [mediaId]);
      await client.query(`INSERT INTO investigation_sources (investigation_id, source_id, discovery_method, relevance_rank, used_in_analysis)
        VALUES ($1, $2, 'user_submission', $3, false)`, [id, source.rows[0]!.source_id, rank]);
    }
    // This milestone records references only. Do not fabricate fetched content,
    // analysis, verified findings, a result summary, or a completed investigation.
    return { outcome: 'collected' };
  });
}
