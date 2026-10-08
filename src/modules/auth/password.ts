import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$32768$8$1$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split('$');
  if (parts.length !== 6 || parts.slice(0, 4).join('$') !== 'scrypt$32768$8$1' ||
      !/^[a-f0-9]{32}$/.test(parts[4] ?? '') || !/^[a-f0-9]{128}$/.test(parts[5] ?? '')) return false;
  const actual = await derive(password, Buffer.from(parts[4]!, 'hex'));
  return timingSafeEqual(actual, Buffer.from(parts[5]!, 'hex'));
}
