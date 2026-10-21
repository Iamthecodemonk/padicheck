import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { Queue, UnrecoverableError } from 'bullmq';
import { boundedQueueCall, queueConnection } from './investigation-jobs.js';
import type { OtpMailer, OtpDeliveryContext } from '../modules/auth/identity-types.js';

export const otpEmailQueue = 'padicheck-otp-email-v1';
export const otpEmailJob = 'send-verification-code';
export type OtpEmailJob = { sealed: string };
type Delivery = OtpDeliveryContext & { email: string; code: string };
const encryptionKey = (secret: string) => Buffer.from(hkdfSync('sha256', secret, 'padicheck', 'otp-email-v1', 32));

// OTPs must be recoverable by the worker, but never stored as plaintext job data.
export function sealOtpEmail(delivery: Delivery, secret: string): OtpEmailJob {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(delivery), 'utf8'), cipher.final()]);
  return { sealed: Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url') };
}

export function openOtpEmail(job: OtpEmailJob, secret: string): Delivery {
  try {
    if (typeof job?.sealed !== 'string' || job.sealed.length > 4096 || !/^[\w-]+$/.test(job.sealed)) throw new Error();
    const bytes = Buffer.from(job.sealed, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const value = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')) as Delivery;
    if (!/^[a-f0-9]{64}$/.test(value.key) || !/^[0-9a-f-]{36}$/i.test(value.challenge_id) ||
      typeof value.email !== 'string' || value.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) ||
      !/^\d{6}$/.test(value.code) || !Number.isSafeInteger(value.expires_at)) throw new Error();
    return value;
  } catch { throw new UnrecoverableError('Invalid encrypted OTP delivery'); }
}

export function queuedOtpMailer(url: string, secret: string): OtpMailer {
  const queue = new Queue<OtpEmailJob>(otpEmailQueue, { connection: queueConnection(url),
    defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true, removeOnFail: true } });
  queue.on('error', () => {});
  return createQueuedOtpMailer(queue, secret);
}

export function createQueuedOtpMailer(queue: Pick<Queue<OtpEmailJob>, 'add' | 'getJobCounts' | 'close'>, secret: string): OtpMailer {
  return {
    async sendCode(email, code, context) {
      if (!context) throw new Error('OTP delivery context required');
      await boundedQueueCall(queue.add(otpEmailJob, sealOtpEmail({ ...context, email, code }, secret), { jobId: context.challenge_id }));
    },
    async verify() { await boundedQueueCall(queue.getJobCounts('waiting')); },
    async close() { await queue.close(); },
  };
}

// Atomically check that a delayed/retried job still refers to a valid challenge.
export const otpDeliveryTtlLua = `local data=redis.call('HGET',KEYS[1],'data'); if not data then return 0 end
if cjson.decode(data).challenge_id ~= ARGV[1] then return 0 end return redis.call('PTTL',KEYS[1])`;

export async function processOtpEmail(job: OtpEmailJob, secret: string,
  currentTtl: (key: string, id: string) => Promise<number>, mailer: OtpMailer, clock = Date.now) {
  const delivery = openOtpEmail(job, secret);
  if (delivery.expires_at - clock() < 30000 || await currentTtl(delivery.key, delivery.challenge_id) < 30000) return 'skipped';
  // SMTP failures must propagate so BullMQ retries; never attach input to errors.
  await mailer.sendCode(delivery.email, delivery.code);
  return 'sent';
}
