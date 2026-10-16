import type { Database } from '../../database/index.js';
import type { InvestigationJobs } from './types.js';
import { failCollection, revisionSql } from './service.js';

export type ReconcileCursor = { created_at: string; investigation_id: string };

export async function reconcileInvestigations(db: Database, jobs: InvestigationJobs, cursor?: ReconcileCursor) {
  // Keyset pages prevent completed collection jobs at the front of the scan
  // from starving newer requests. A subsequent cycle restarts from the front.
  const result = await db.query<{ investigation_id: string; status: string; cursor_time: string; dispatch_revision: string }>(`
    SELECT investigation_id, status,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time, ${revisionSql} AS dispatch_revision
    FROM investigations WHERE status IN ('queued', 'collecting_sources')
    AND ($1::timestamptz IS NULL OR (created_at, investigation_id) > ($1::timestamptz, $2::uuid))
    ORDER BY created_at, investigation_id LIMIT 100`, [cursor?.created_at ?? null, cursor?.investigation_id ?? null]);
  for (const row of result.rows) {
    const state = await jobs.enqueue(row.investigation_id, row.status === 'queued', row.dispatch_revision);
    if (state === 'failed') {
      await failCollection(db, row.investigation_id, 'source_collection_failed', row.dispatch_revision);
    }
  }
  const last = result.rows.at(-1);
  return result.rows.length === 100 && last ? { created_at: last.cursor_time, investigation_id: last.investigation_id } : undefined;
}
