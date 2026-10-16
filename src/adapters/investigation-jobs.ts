import { Queue, type RedisOptions } from 'bullmq';
import type { InvestigationJobs, QueueState } from '../modules/investigations/types.js';

export const sourceCollectionQueue = 'padicheck-source-collection-v1';
export const collectionJobName = 'collect-submitted-sources';
export type CollectionJobData = { investigation_id: string; dispatch_revision: string };
type StoredJob = { data: CollectionJobData; getState(): Promise<QueueState>;
  retry(state: 'completed' | 'failed', options: { resetAttemptsMade: boolean; resetAttemptsStarted: boolean }): Promise<void> };
export interface CollectionQueueTransport {
  getJob(id: string): Promise<StoredJob | undefined>;
  add(name: string, data: CollectionJobData, options: { jobId: string }): Promise<unknown>;
  getJobCounts(state: 'waiting'): Promise<unknown>;
  close(): Promise<void>;
}

export function queueConnection(url: string, worker = false): RedisOptions {
  return { url, connectTimeout: 3000, maxRetriesPerRequest: worker ? null : 1,
    enableOfflineQueue: worker, retryStrategy: (times: number) => Math.min(times * 250, 2000) };
}

export async function boundedQueueCall<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Background queue unavailable')), 3500);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

export function investigationJobs(redisUrl: string): InvestigationJobs {
  const queue = new Queue<CollectionJobData>(sourceCollectionQueue, {
    connection: queueConnection(redisUrl),
    defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 86400, count: 10000 }, removeOnFail: { age: 604800, count: 10000 } },
  });
  queue.on('error', () => {}); // Callers report sanitized failures/deferred dispatch.
  return createInvestigationJobAdapter(queue);
}

export function createInvestigationJobAdapter(queue: CollectionQueueTransport): InvestigationJobs {
  return {
    enqueue(id, restartFinished, revision) {
      return boundedQueueCall((async (): Promise<QueueState> => {
        const existing = await queue.getJob(id);
        if (existing) {
          const state = await existing.getState();
          if (restartFinished && existing.data.dispatch_revision !== revision && (state === 'completed' || state === 'failed')) {
            // Requeue first. The worker stamps the current DB revision before
            // collection. Updating it here before retry would lose dispatch if
            // this process crashed between updateData and retry.
            await existing.retry(state, { resetAttemptsMade: true, resetAttemptsStarted: true });
            return 'waiting';
          }
          return state;
        }
        await queue.add(collectionJobName, { investigation_id: id, dispatch_revision: revision }, { jobId: id });
        return 'waiting';
      })());
    },
    ping() { return boundedQueueCall((async () => { await queue.getJobCounts('waiting'); })()); },
    async close() { await queue.close(); },
  };
}
