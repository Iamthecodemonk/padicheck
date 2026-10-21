import { Queue, type RedisOptions } from 'bullmq';
import { isIP } from 'node:net';
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
  // ioredis options objects do not interpret a `url` property. Parse the URL
  // explicitly so queues/workers use the same host, credentials and DB as auth.
  const parsed = new URL(url);
  if (!['redis:', 'rediss:'].includes(parsed.protocol) || !/^\/(?:\d+)?$/.test(parsed.pathname || '/') || parsed.search || parsed.hash) {
    throw new Error('Invalid Redis queue connection URL');
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  const database = Number(parsed.pathname.slice(1) || 0);
  if (!Number.isSafeInteger(database) || database < 0) throw new Error('Invalid Redis queue database');
  return { host, port: Number(parsed.port || 6379), db: database,
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(parsed.protocol === 'rediss:' ? { tls: isIP(host) ? {} : { servername: host } } : {}),
    connectTimeout: 3000, maxRetriesPerRequest: worker ? null : 1,
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
    enqueue(id, restartFinished, revision, continueCompleted = false) {
      return boundedQueueCall((async (): Promise<QueueState> => {
        const existing = await queue.getJob(id);
        if (existing) {
          const state = await existing.getState();
          if ((continueCompleted && state === 'completed') ||
              (restartFinished && existing.data.dispatch_revision !== revision && (state === 'completed' || state === 'failed'))) {
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
