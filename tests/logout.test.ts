import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { memoryRevocations } from '../src/modules/auth/revocations.js';
import { testDatabase } from './support/database.js';
import { ApiError } from '../src/errors.js';

const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: 'postgres://unused:unused@localhost/test',
  JWT_SECRET: 'test-secret-32-bytes-minimum-long-value' });

test('logout revokes only the submitted token across instances sharing a store', async () => {
  const { db } = await testDatabase();
  const revocations = memoryRevocations();
  const app = buildApp(config, db, { revocations });
  const second = buildApp(config, db, { revocations });
  try {
    const credentials = { email: 'logout@example.com', password: 'Logout password long enough' };
    const registration = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { ...credentials, display_name: 'Logout test' } });
    assert.equal(registration.statusCode, 201);
    const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: credentials });
    assert.equal(login.statusCode, 200);
    const firstToken = registration.json().access_token;
    const secondToken = login.json().access_token;
    assert.notEqual(firstToken, secondToken);
    const headers = { authorization: `Bearer ${firstToken}` };
    assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/logout', headers })).statusCode, 204);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/auth/me', headers })).statusCode, 401);
    assert.equal((await second.inject({ method: 'GET', url: '/v1/auth/me', headers })).statusCode, 401);
    assert.equal((await second.inject({ method: 'GET', url: '/v1/auth/me', headers: { authorization: `Bearer ${secondToken}` } })).statusCode, 200);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/logout' })).statusCode, 401);
    const activeHeaders = { authorization: `Bearer ${secondToken}` };
    const originalRevoke = revocations.revoke;
    revocations.revoke = async () => { throw new ApiError(503, 'auth_unavailable', 'Unavailable'); };
    assert.equal((await second.inject({ method: 'POST', url: '/v1/auth/logout', headers: activeHeaders })).statusCode, 503);
    revocations.revoke = originalRevoke;
    assert.equal((await second.inject({ method: 'GET', url: '/v1/auth/me', headers: activeHeaders })).statusCode, 200);
    const originalHas = revocations.has;
    const originalPing = revocations.ping;
    revocations.has = revocations.ping = async () => { throw new ApiError(503, 'auth_unavailable', 'Unavailable'); };
    assert.equal((await second.inject({ method: 'GET', url: '/v1/auth/me', headers: activeHeaders })).statusCode, 503);
    assert.equal((await second.inject('/ready')).statusCode, 503);
    assert.equal((await second.inject('/health')).statusCode, 200);
    revocations.has = originalHas; revocations.ping = originalPing;
  } finally { await app.close(); await second.close(); await revocations.close(); await db.close(); }
});

test('revocation entries expire', async () => {
  const store = memoryRevocations();
  await store.revoke('expired', Math.floor(Date.now() / 1000) - 1);
  assert.equal(await store.has('expired'), false);
  await store.revoke('active', Math.floor(Date.now() / 1000) + 10);
  assert.equal(await store.has('active'), true);
  await store.close();
});

test('production requires Redis and partial Cloudinary credentials are rejected', () => {
  const env = { DATABASE_URL: config.databaseUrl, JWT_SECRET: config.jwtSecret };
  assert.throws(() => loadConfig({ ...env, NODE_ENV: 'production' }), /REDIS_URL/);
  assert.throws(() => loadConfig({ ...env, CLOUDINARY_API_KEY: 'only-one-value' }), /Cloudinary/);
  assert.throws(() => loadConfig({ ...env, MEDIA_MAX_BYTES: '0' }), /MEDIA_MAX_BYTES/);
});
