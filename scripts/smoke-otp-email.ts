import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { createClient } from 'redis';
import { loadConfig } from '../src/config.js';
import { redisAuthChallenges } from '../src/adapters/auth-challenges.js';
import { queueConnection } from '../src/adapters/investigation-jobs.js';
import { createQueuedOtpMailer, otpEmailJob, processOtpEmail, otpDeliveryTtlLua, type OtpEmailJob } from '../src/adapters/otp-email-jobs.js';
import { logger } from '../src/logger.js';
import { pruneStaleOtpEmails } from '../src/adapters/otp-email-maintenance.js';

// Real Redis/BullMQ, isolated queue and synthetic records. Never sends email.
const config = loadConfig();
if (config.nodeEnv === 'production' || !config.redisUrl) throw new Error('Use development Redis');
const queueName = `padicheck-otp-smoke-${randomUUID()}`;
const queue = new Queue<OtpEmailJob>(queueName, { connection: queueConnection(config.redisUrl),
  defaultJobOptions: { attempts: 3, backoff: { type: 'fixed', delay: 100 } } });
const events = new QueueEvents(queueName, { connection: queueConnection(config.redisUrl, true) });
queue.on('error', () => {}); events.on('error', () => {});
const challenges = redisAuthChallenges(config.redisUrl);
const redis = createClient({ url: config.redisUrl, socket: { connectTimeout: 3000, reconnectStrategy: false } });
redis.on('error', () => {});
let worker: Worker<OtpEmailJob> | undefined;
const records: { key: string; challenge_id: string; expires_at: number }[] = [];
let sends = 0;
let attempts = 0;
try {
  await redis.connect();
  await events.waitUntilReady();
  const mailer = createQueuedOtpMailer(queue, config.jwtSecret);
  // Enqueue with no worker running, proving SMTP is outside the request path.
  for (let i = 0; i < 3; i++) {
    const key = randomBytes(32).toString('hex');
    const challenge_id = randomUUID();
    assert.equal(await challenges.putOtp(key, { challenge_id, purpose: 'signup', code_digest: 'synthetic-digest', email: 'sink@example.invalid' }), true);
    const context = { key, challenge_id, expires_at: Date.now() + (i === 2 ? -1 : 600000) };
    records.push(context);
    const started = Date.now();
    await mailer.sendCode('sink@example.invalid', '012345', context);
    assert.equal(sends, 0);
    logger.info({ enqueue_ms: Date.now() - started }, 'Synthetic OTP queued without SMTP worker');
    if (i === 1) await challenges.discardOtp(key, challenge_id);
  }
  worker = new Worker<OtpEmailJob>(queueName, async job => {
    assert.equal(job.name, otpEmailJob);
    return processOtpEmail(job.data, config.jwtSecret, async (key, id) => Number(await redis.eval(otpDeliveryTtlLua,
      { keys: [`padicheck:auth:v1:{${key}}:otp`], arguments: [id] })), {
      async sendCode(email, code) {
        assert.equal(email, 'sink@example.invalid'); assert.equal(code, '012345');
        if (++attempts === 1) throw new Error('Synthetic SMTP timeout');
        sends++;
      }, async verify() {}, close() {},
    });
  }, { connection: queueConnection(config.redisUrl, true), concurrency: 1 });
  worker.on('error', () => {});
  const results = await Promise.all(records.map(async record => {
    const job = await queue.getJob(record.challenge_id); assert.ok(job);
    return job.waitUntilFinished(events, 20000);
  }));
  assert.deepEqual(results, ['sent', 'skipped', 'skipped']);
  assert.equal(sends, 1); assert.equal(attempts, 2);
  // Pause only this synthetic worker, leaving the real OTP queue untouched.
  await worker.pause();
  const pendingIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const key = randomBytes(32).toString('hex'); const challenge_id = randomUUID();
    assert.equal(await challenges.putOtp(key, { challenge_id, purpose: 'signup', code_digest: 'synthetic-digest', email: 'sink@example.invalid' }), true);
    const record = { key, challenge_id, expires_at: Date.now() + (i === 1 ? -1 : 600000) };
    records.push(record); pendingIds.push(challenge_id);
    await mailer.sendCode('sink@example.invalid', '012345', record);
    if (i === 2) await challenges.discardOtp(key, challenge_id);
  }
  const ttl = async (key: string, id: string) => Number(await redis.eval(otpDeliveryTtlLua,
    { keys: [`padicheck:auth:v1:{${key}}:otp`], arguments: [id] }));
  const preview = await pruneStaleOtpEmails(queue, config.jwtSecret, ttl);
  assert.equal(preview.stale, 2); assert.equal(preview.removed, 0); assert.equal(preview.kept_valid, 1);
  const pruned = await pruneStaleOtpEmails(queue, config.jwtSecret, ttl, { apply: true });
  assert.equal(pruned.removed, 2); assert.equal(pruned.kept_valid, 1);
  assert.ok(await queue.getJob(pendingIds[0]!));
  assert.equal(await queue.getJob(pendingIds[1]!), undefined);
  assert.equal(await queue.getJob(pendingIds[2]!), undefined);
  assert.equal(sends, 1);
  logger.info({ stale_removed: pruned.removed, valid_preserved: pruned.kept_valid }, 'Isolated Redis OTP cleanup passed');
  logger.info({ passed: true, retry_attempts: attempts, sent: sends, skipped: 2 }, 'OTP queue smoke passed; no real emails sent');
} finally {
  await worker?.close();
  await events.close();
  for (const record of records) await challenges.discardOtp(record.key, record.challenge_id);
  await challenges.close();
  if (redis.isOpen) redis.destroy();
  // queueName is generated above and cannot refer to a production queue.
  await queue.obliterate({ force: true });
  await queue.close();
}
