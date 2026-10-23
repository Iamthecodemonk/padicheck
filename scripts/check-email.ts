import 'dotenv/config';
import { Queue } from 'bullmq';
import { loadConfig } from '../src/config.js';
import { queueConnection, boundedQueueCall } from '../src/adapters/investigation-jobs.js';
import { otpEmailQueue } from '../src/adapters/otp-email-jobs.js';
import { logger } from '../src/logger.js';

// Read-only operational check. No recipients, OTPs, job payloads or credentials.
const config = loadConfig();
if (!config.redisUrl) throw new Error('REDIS_URL is required for email queue checks');
const queue = new Queue(otpEmailQueue, { connection: queueConnection(config.redisUrl) });
queue.on('error', () => {});
try {
  const [counts, workers, paused] = await Promise.all([
    boundedQueueCall(queue.getJobCounts('waiting', 'active', 'delayed', 'failed')),
    boundedQueueCall(queue.getWorkers()),
    boundedQueueCall(queue.isPaused()),
  ]);
  const ready = Boolean(config.smtp) && workers.length > 0 && !paused;
  process.stdout.write(JSON.stringify({
    smtp_configured: Boolean(config.smtp), connected_workers: workers.length,
    queue_paused: paused, counts, ready_to_process: ready,
    ...(workers.length === 0 ? { action: 'Start npm run email:worker:dev in a separate terminal; keep it running alongside the API.' } : {}),
    ...(paused ? { action: 'Email queue is paused; investigate the operator pause before resuming delivery.' } : {}),
    note: 'Connected workers are not proof of inbox delivery. Inspect worker queue_wait_ms and elapsed_ms for delays.',
  }, null, 2) + '\n');
  if (!ready) process.exitCode = 1;
} catch {
  logger.error('Email queue check failed; verify Redis connectivity');
  process.exitCode = 1;
} finally { await queue.close(); }
