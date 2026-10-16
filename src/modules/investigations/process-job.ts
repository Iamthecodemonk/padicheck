import type { Database } from '../../database/index.js';
import { collectSubmittedSources } from './collector.js';
import { revisionSql } from './service.js';
import type { CollectionJobData } from '../../adapters/investigation-jobs.js';

export async function processCollectionJob(db: Database, job: {
  data: CollectionJobData; updateData(data: CollectionJobData): Promise<void>;
}) {
  const result = await db.query<{ dispatch_revision: string }>(`SELECT ${revisionSql} AS dispatch_revision
    FROM investigations WHERE investigation_id = $1 AND status IN ('queued', 'collecting_sources')`, [job.data.investigation_id]);
  const row = result.rows[0];
  if (!row) return { outcome: 'ignored' as const };
  await job.updateData({ investigation_id: job.data.investigation_id, dispatch_revision: row.dispatch_revision });
  return collectSubmittedSources(db, job.data.investigation_id);
}
