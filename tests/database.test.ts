import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase } from '../src/database/index.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

test('unavailable PostgreSQL fails readiness but keeps process liveness', async () => {
  const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://unused:unused@127.0.0.1:1/unavailable', JWT_SECRET: 'test-secret-32-bytes-minimum-long-value' });
  const db = createDatabase(config.databaseUrl);
  const app = buildApp(config, db);
  try {
    await assert.rejects(db.query('SELECT 1'));
    assert.equal((await app.inject('/ready')).statusCode, 503);
    assert.equal((await app.inject('/health')).statusCode, 200);
    const login = await app.inject({ method: 'POST', url: '/v1/auth/login',
      payload: { email: 'unused@example.com', password: 'Password long enough' } });
    assert.equal(login.statusCode, 500);
    assert.ok(!login.body.includes('postgres://'));
  } finally { await app.close(); await db.close(); }
});
