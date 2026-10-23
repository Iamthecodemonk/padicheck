import 'dotenv/config';
import { Queue } from 'bullmq';
import { createClient } from 'redis';
import { loadConfig } from '../src/config.js';
import { queueConnection } from '../src/adapters/investigation-jobs.js';
import { otpEmailQueue, otpDeliveryTtlLua, type OtpEmailJob } from '../src/adapters/otp-email-jobs.js';
import { pruneStaleOtpEmails } from '../src/adapters/otp-email-maintenance.js';
import { logger } from '../src/logger.js';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--apply') || args.length > 1) throw new Error('Usage: npm run email:prune -- [--apply]');
const config = loadConfig();
if (!config.redisUrl) throw new Error('REDIS_URL is required for email queue cleanup');
const queue = new Queue<OtpEmailJob>(otpEmailQueue, { connection: queueConnection(config.redisUrl) });
const redis = createClient({ url: config.redisUrl, disableOfflineQueue: true,
  socket: { connectTimeout: 3000, reconnectStrategy: false } });
queue.on('error', () => {}); redis.on('error', () => {});
try {
  await redis.connect();
  const result = await pruneStaleOtpEmails(queue, config.jwtSecret, async (key, id) =>
    Number(await redis.eval(otpDeliveryTtlLua, { keys: [`padicheck:auth:v1:{${key}}:otp`], arguments: [id] })),
  { apply: args.includes('--apply') });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.unreadable || result.remove_conflicts) process.exitCode = 1;
} catch {
  logger.error('Email cleanup incomplete; verify Redis connectivity and shared encryption configuration');
  process.exitCode = 1;
} finally {
  if (redis.isOpen) redis.destroy();
  await queue.close();
}
