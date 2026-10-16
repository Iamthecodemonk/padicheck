import 'dotenv/config';
import { Worker, UnrecoverableError } from 'bullmq';
import { createDatabase } from '../database/index.js';
import { loadConfig, validateWorkerConfig } from '../config.js';
import { investigationJobs, queueConnection, sourceCollectionQueue, collectionJobName, type CollectionJobData } from '../adapters/investigation-jobs.js';
import { processCollectionJob } from '../modules/investigations/process-job.js';
import { failCollection } from '../modules/investigations/service.js';
import { reconcileInvestigations, type ReconcileCursor } from '../modules/investigations/reconcile.js';
import { uuidPattern } from '../modules/investigations/validation.js';
import { researchAdapters } from '../adapters/research.js';
import { deadline, gracefulShutdown } from '../runtime/lifecycle.js';
import { databaseReadiness, researchReadiness } from '../runtime/readiness.js';

async function main() {
  const config = loadConfig();
  validateWorkerConfig(config);
  const db = createDatabase(config.databaseUrl);
  const jobs = investigationJobs(config.redisUrl!);
  const research = config.researchEnabled ? researchAdapters(config) : undefined;
  let worker: Worker<CollectionJobData> | undefined;
  let closing = false;
  let cursor: ReconcileCursor | undefined;
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  const failureWrites = new Set<Promise<void>>();
  const close = gracefulShutdown({
    timeoutMs: config.shutdownTimeoutMs,
    steps: [
      { name: 'worker', close: async () => { await worker?.close(); } },
      { name: 'reconciliation', close: async () => { await running; } },
      { name: 'failure_status', close: async () => { await Promise.all(failureWrites); } },
      { name: 'queue', close: () => jobs.close() },
      { name: 'database', close: () => db.close() },
    ],
    onError: name => { console.error(`Source-collection shutdown failed at ${name}`); process.exitCode = 1; },
  });
  function shutdown() {
    closing = true;
    if (timer) clearInterval(timer);
    return close();
  }
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  function reconcile() {
    if (closing || running) return;
    running = (async () => {
      try { cursor = await reconcileInvestigations(db, jobs, cursor, config.researchEnabled); }
      catch { console.error('Investigation dispatch deferred; reconciliation will retry'); }
      finally { running = undefined; }
    })();
  }
  try {
    await deadline((async () => {
      await databaseReadiness(db);
      await researchReadiness(db, config);
      await jobs.ping();
    })(), config.startupTimeoutMs);
    if (closing) return;
    worker = new Worker<CollectionJobData>(sourceCollectionQueue, async job => {
      if (job.name !== collectionJobName || !uuidPattern.test(job.data?.investigation_id ?? '')) {
        throw new UnrecoverableError('Unsupported source collection job');
      }
      return processCollectionJob(db, job, research);
    }, { connection: queueConnection(config.redisUrl!, true), concurrency: config.workerConcurrency, autorun: false });

    worker.on('error', () => console.error('Source-collection worker connection error'));
    worker.on('failed', job => {
      if (!job || !uuidPattern.test(job.data?.investigation_id ?? '') || job.attemptsMade < (job.opts.attempts ?? 1)) return;
      const write = failCollection(db, job.data.investigation_id, 'source_collection_failed', job.data.dispatch_revision).catch(() => {
        console.error('Investigation failure status needs reconciliation');
      });
      failureWrites.add(write);
      void write.finally(() => failureWrites.delete(write));
    });
    await deadline(worker.waitUntilReady(), config.startupTimeoutMs);
    if (closing) { await worker.close(); return; }
    void worker.run().catch(() => {
      console.error('Source-collection worker stopped unexpectedly');
      process.exitCode = 1;
      void shutdown();
    });
    timer = setInterval(reconcile, config.reconcileIntervalMs);
    reconcile();
    console.info('Source-collection worker ready');
  } catch {
    console.error('Source-collection startup failed; check configuration and dependency readiness');
    process.exitCode = 1;
    await shutdown();
  }
}
await main().catch(() => { console.error('Source-collection configuration or initialization failed'); process.exitCode = 1; });
