import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { UnrecoverableError } from 'bullmq';
import { otpEmail } from '../src/modules/auth/otp-email.js';
import { sealOtpEmail, openOtpEmail, processOtpEmail } from '../src/adapters/otp-email-jobs.js';
import type { OtpMailer } from '../src/modules/auth/identity-types.js';

const secret = 'test-only-otp-encryption-secret-long-enough';
const now = 1700000000000;
const delivery = { email: 'private@example.com', code: '012345', key: 'a'.repeat(64),
  challenge_id: randomUUID(), expires_at: now + 600000 };

test('OTP template preserves leading zeros in HTML and plain text and rejects HTML input', () => {
  const email = otpEmail(delivery.code);
  assert.ok(email.html.includes('012345'));
  assert.ok(email.text.includes('012345'));
  assert.ok(email.html.includes('10 minutes after your request'));
  assert.ok(!email.html.includes('<img'));
  assert.throws(() => otpEmail('<script>'), /Invalid/);
});

test('queued email data is encrypted, authenticated, randomized and bound to the shared secret', () => {
  const job = sealOtpEmail(delivery, secret);
  assert.deepEqual(openOtpEmail(job, secret), delivery);
  assert.notEqual(job.sealed, sealOtpEmail(delivery, secret).sealed);
  const bytes = Buffer.from(job.sealed, 'base64url');
  assert.equal(bytes.includes(Buffer.from(delivery.email)), false);
  assert.equal(bytes.includes(Buffer.from(delivery.code)), false);
  bytes[30] = bytes[30]! ^ 1;
  assert.throws(() => openOtpEmail({ sealed: bytes.toString('base64url') }, secret), UnrecoverableError);
  assert.throws(() => openOtpEmail(job, 'wrong-secret'), UnrecoverableError);
  assert.throws(() => openOtpEmail({ sealed: 'invalid' }, secret), UnrecoverableError);
});

test('worker skips expired, near-expiry, consumed and superseded OTP challenges', async () => {
  let sends = 0;
  const mailer: OtpMailer = { async sendCode() { sends++; }, async verify() {}, close() {} };
  for (const expires_at of [now - 1, now + 29999]) {
    assert.equal(await processOtpEmail(sealOtpEmail({ ...delivery, expires_at }, secret), secret,
      async () => 600000, mailer, () => now), 'skipped');
  }
  for (const ttl of [0, -2, 10000]) {
    assert.equal(await processOtpEmail(sealOtpEmail(delivery, secret), secret, async (key, id) => {
      assert.equal(key, delivery.key); assert.equal(id, delivery.challenge_id); return ttl;
    }, mailer, () => now), 'skipped');
  }
  assert.equal(sends, 0);
});

test('worker propagates SMTP failure for retries and sends the same valid code on retry', async () => {
  let sends = 0;
  const mailer: OtpMailer = { async sendCode(email, code) {
    assert.equal(email, delivery.email); assert.equal(code, delivery.code);
    if (++sends === 1) throw new Error('Temporary SMTP outage');
  }, async verify() {}, close() {} };
  const job = sealOtpEmail(delivery, secret);
  await assert.rejects(processOtpEmail(job, secret, async () => 600000, mailer, () => now), /Temporary/);
  assert.equal(await processOtpEmail(job, secret, async () => 590000, mailer, () => now), 'sent');
  assert.equal(sends, 2);
});

test('worker does not send when challenge validation fails or Redis is unavailable', async () => {
  const mailer: OtpMailer = { async sendCode() { assert.fail('Must not send'); }, async verify() {}, close() {} };
  await assert.rejects(processOtpEmail(sealOtpEmail(delivery, secret), secret,
    async () => { throw new Error('Redis unavailable'); }, mailer, () => now), /Redis unavailable/);
});
