import { createClient } from 'redis';
import { ApiError } from '../../errors.js';

export interface TokenRevocations {
  has(digest: string): Promise<boolean>;
  revoke(digest: string, expiresAt: number): Promise<void>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

// Development/tests only. Revocations do not survive process restarts.
export function memoryRevocations(): TokenRevocations {
  const entries = new Map<string, number>();
  const prune = () => {
    const now = Math.floor(Date.now() / 1000);
    for (const [key, expiry] of entries) if (expiry <= now) entries.delete(key);
  };
  return {
    async has(digest) { prune(); return entries.has(digest); },
    async revoke(digest, expiresAt) {
      prune();
      if (entries.size >= 10000 && !entries.has(digest)) throw new ApiError(503, 'auth_unavailable', 'Token revocation is unavailable');
      entries.set(digest, expiresAt);
    },
    async ping() {},
    async close() { entries.clear(); },
  };
}

export function redisRevocations(url: string): TokenRevocations {
  const client = createClient({ url, disableOfflineQueue: true,
    socket: { connectTimeout: 3000, reconnectStrategy: false } });
  client.on('error', () => {}); // Errors are surfaced as sanitized API failures.
  let connecting: Promise<unknown> | undefined;
  async function ready() {
    if (client.isReady) return;
    connecting ??= client.connect().finally(() => { connecting = undefined; });
    await connecting;
  }
  async function run<T>(operation: () => Promise<T>): Promise<T> {
    try { await ready(); return await operation(); }
    catch { throw new ApiError(503, 'auth_unavailable', 'Token revocation is unavailable'); }
  }
  return {
    has: digest => run(async () => (await client.exists(`padicheck:revoked:${digest}`)) === 1),
    revoke: (digest, expiresAt) => run(async () => {
      const ttl = Math.max(1, expiresAt - Math.floor(Date.now() / 1000));
      await client.set(`padicheck:revoked:${digest}`, '1', { EX: ttl });
    }),
    ping: () => run(async () => { await client.ping(); }),
    async close() { if (client.isOpen) client.destroy(); },
  };
}
