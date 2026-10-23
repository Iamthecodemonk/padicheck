import { boundedQueueCall } from './investigation-jobs.js';
import { isOtpEmailStale, openOtpEmail, otpEmailJob, type OtpEmailJob } from './otp-email-jobs.js';

type PendingJob = { name: string; data: OtpEmailJob; getState(): Promise<string>; remove(): Promise<void> };
type MaintenanceQueue = { getJobs(states: ('waiting' | 'delayed' | 'failed')[], start: number, end: number, asc: boolean): Promise<PendingJob[]> };

// Never pause/drain the queue or delete auth challenges, cooldowns or quotas.
// BullMQ's remove script also refuses a locked job if a worker starts it after inspection.
export async function pruneStaleOtpEmails(queue: MaintenanceQueue, secret: string,
  currentTtl: (key: string, id: string) => Promise<number>, options: { apply?: boolean; limit?: number; clock?: () => number } = {}) {
  const limit = options.limit ?? 500;
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) throw new Error('Invalid email scan limit');
  const jobs = await boundedQueueCall(queue.getJobs(['waiting', 'delayed', 'failed'], 0, limit, true));
  const result = { mode: options.apply ? 'apply' : 'dry_run', scanned: 0, stale: 0, removed: 0,
    kept_valid: 0, skipped_state: 0, unreadable: 0, remove_conflicts: 0, scan_limited: jobs.length > limit };
  for (const job of jobs.slice(0, limit)) {
    result.scanned++;
    const state = await boundedQueueCall(job.getState());
    if (!['waiting', 'delayed', 'failed'].includes(state) || job.name !== otpEmailJob) { result.skipped_state++; continue; }
    let delivery: ReturnType<typeof openOtpEmail>;
    try { delivery = openOtpEmail(job.data, secret); }
    catch { result.unreadable++; continue; } // A wrong encryption key must never purge valid mail.
    const stale = await isOtpEmailStale(delivery, (key, id) => boundedQueueCall(currentTtl(key, id)), options.clock);
    if (!stale) { result.kept_valid++; continue; }
    result.stale++;
    if (!options.apply) continue;
    try { await boundedQueueCall(job.remove()); result.removed++; }
    catch { result.remove_conflicts++; } // In-flight mail is left to the worker's own expiry check.
  }
  return result;
}
