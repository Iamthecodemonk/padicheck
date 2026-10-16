import 'dotenv/config';
import { Worker, UnrecoverableError } from 'bullmq';
import { createDatabase } from '../database/index.js';
import { loadConfig } from '../config.js';
import { investigationJobs, queueConnection, sourceCollectionQueue, collectionJobName, type CollectionJobData } from '../adapters/investigation-jobs.js';
import { processCollectionJob } from '../modules/investigations/process-job.js';
import { failCollection } from '../modules/investigations/service.js';
import { reconcileInvestigations, type ReconcileCursor } from '../modules/investigations/reconcile.js';
import { uuidPattern } from '../modules/investigations/validation.js';

const config = loadConfig();
if (!config.redisUrl) throw new Error('REDIS_URL is required to run the source-collection worker');
const db = createDatabase(config.databaseUrl);
const jobs = investigationJobs(config.redisUrl);
const worker = new Worker<CollectionJobData>(sourceCollectionQueue, async job => {
  if (job.name !== collectionJobName || !uuidPattern.test(job.data?.investigation_id ?? '')) {
    throw new UnrecoverableError('Unsupported source collection job');
  }
  return processCollectionJob(db, job);
}, { connection: queueConnection(config.redisUrl, true), concurrency: config.workerConcurrency });

worker.on('error', () => console.error('Source-collection worker connection error'));
worker.on('failed', (job) => {
  if (!job || !uuidPattern.test(job.data?.investigation_id ?? '') || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  void failCollection(db, job.data.investigation_id, 'source_collection_failed', job.data.dispatch_revision).catch(() => {
    console.error('Investigation failure status needs reconciliation');
  });
});

let closing = false;
let cursor: ReconcileCursor | undefined;
let running: Promise<void> | undefined;
function reconcile() {
  if (closing || running) return;
  running = (async () => {
    try { cursor = await reconcileInvestigations(db, jobs, cursor); }
    catch { console.error('Investigation dispatch deferred; reconciliation will retry'); }
    finally { running = undefined; }
  })();
}
const timer = setInterval(reconcile, config.reconcileIntervalMs);
reconcile();

async function shutdown() {
  if (closing) return;
  closing = true;
  clearInterval(timer);
  const deadline = setTimeout(() => process.exit(1), 30_000);
  deadline.unref();
  try { await running; await worker.close(); await jobs.close(); await db.close(); }
  catch { console.error('Source-collection worker shutdown failed'); process.exitCode = 1; }
  finally { clearTimeout(deadline); }
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
