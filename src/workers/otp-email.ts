import 'dotenv/config';
import { Worker, UnrecoverableError } from 'bullmq';
import { createClient } from 'redis';
import { loadConfig } from '../config.js';
import { logger as rootLogger } from '../logger.js';
import { smtpMailer } from '../adapters/smtp.js';
import { queueConnection } from '../adapters/investigation-jobs.js';
import { otpEmailQueue, otpEmailJob, otpDeliveryTtlLua, processOtpEmail, type OtpEmailJob } from '../adapters/otp-email-jobs.js';
import { deadline, gracefulShutdown } from '../runtime/lifecycle.js';

const logger = rootLogger.child({ component: 'otp-email-worker' });
async function main() {
  const config = loadConfig();
  if (!config.redisUrl || !config.smtp) throw new Error('Email worker requires Redis and SMTP');
  const mailer = smtpMailer(config.smtp);
  const redis = createClient({ url: config.redisUrl, disableOfflineQueue: true,
    socket: { connectTimeout: 3000, reconnectStrategy: false } });
  redis.on('error', () => logger.error('Email challenge connection failed'));
  let worker: Worker<OtpEmailJob> | undefined;
  let connecting: Promise<unknown> | undefined;
  let closing = false;
  const close = gracefulShutdown({ timeoutMs: config.shutdownTimeoutMs, steps: [
    { name: 'worker', close: async () => { await worker?.close(); } },
    { name: 'smtp', close: async () => { await mailer.close(); } },
    { name: 'redis', close: async () => { if (redis.isOpen) redis.destroy(); } },
  ], onError: step => { logger.error({ step }, 'Email worker shutdown failed'); process.exitCode = 1; } });
  const shutdown = () => { closing = true; return close(); };
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
  try {
    await deadline((async () => { await redis.connect(); await mailer.verify(); })(), config.startupTimeoutMs);
    if (closing) return;
    worker = new Worker<OtpEmailJob>(otpEmailQueue, async job => {
      if (job.name !== otpEmailJob) throw new UnrecoverableError('Unsupported email job');
      const started = Date.now();
      const result = await processOtpEmail(job.data, config.jwtSecret, async (key, id) => {
        if (!redis.isReady) {
          connecting ??= redis.connect().finally(() => { connecting = undefined; });
          await connecting;
        }
        return Number(await redis.eval(otpDeliveryTtlLua, { keys: [`padicheck:auth:v1:{${key}}:otp`], arguments: [id] }));
      }, mailer);
      logger.info({ result, elapsed_ms: Date.now() - started, queue_wait_ms: Math.max(0, started - job.timestamp) }, 'OTP email job completed');
    }, { connection: queueConnection(config.redisUrl, true), concurrency: 2, autorun: false });
    worker.on('error', () => logger.error('Email worker connection error'));
    worker.on('failed', (job, error) => logger.warn({ attempts: job?.attemptsMade,
      exhausted: error instanceof UnrecoverableError || (job?.attemptsMade ?? 0) >= (job?.opts.attempts ?? 1) }, 'OTP email delivery attempt failed'));
    await deadline(worker.waitUntilReady(), config.startupTimeoutMs);
    if (closing) { await worker.close(); return; }
    void worker.run().catch(() => { logger.error('Email worker stopped'); process.exitCode = 1; void shutdown(); });
    logger.info('OTP email worker ready');
  } catch { logger.error('Email worker startup failed; check SMTP and Redis'); process.exitCode = 1; await shutdown(); }
}
await main().catch(() => { logger.error('Email worker configuration failed'); process.exitCode = 1; });
