import type { Database } from '../../database/index.js';
import { collectSubmittedSources } from './collector.js';
import { revisionSql } from './service.js';
import type { CollectionJobData } from '../../adapters/investigation-jobs.js';
import { runResearch } from '../research/pipeline.js';
import type { ResearchAdapters } from '../research/types.js';

export async function processCollectionJob(db: Database, job: {
  data: CollectionJobData; updateData(data: CollectionJobData): Promise<void>;
}, research?: ResearchAdapters) {
  const result = await db.query<{ dispatch_revision: string; status: string }>(`SELECT status, ${revisionSql} AS dispatch_revision
    FROM investigations WHERE investigation_id = $1 AND (status IN ('queued', 'collecting_sources') OR ($2::boolean AND status = 'analyzing'))`, [job.data.investigation_id, !!research]);
  const row = result.rows[0];
  if (!row) return { outcome: 'ignored' as const };
  await job.updateData({ investigation_id: job.data.investigation_id, dispatch_revision: row.dispatch_revision });
  if (row.status !== 'analyzing') {
    const collected = await collectSubmittedSources(db, job.data.investigation_id);
    if (!research || collected.outcome !== 'collected') return collected;
  }
  return runResearch(db, job.data.investigation_id, research!);
}
