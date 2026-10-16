import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { buildTestApp as buildApp, completeRegistration } from '../tests/support/auth.js';
import { loadConfig } from '../src/config.js';
import type { Database } from '../src/database/index.js';
import { collectSubmittedSources } from '../src/modules/investigations/collector.js';

// Exercise real PostgreSQL without leaving test accounts or credentials behind.
// Use SAVEPOINT for application transactions inside a rollback-only outer one.
const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.databaseUrl, connectionTimeoutMillis: 5000 });
let client: pg.PoolClient | undefined;
try {
  client = await pool.connect();
  const connection = client;
  await connection.query('BEGIN');
  const db: Database = {
    query: (sql, values) => connection.query(sql, values),
    session: work => work(connection),
    async transaction(work) {
      await connection.query('SAVEPOINT smoke_work');
      try {
        const result = await work(connection);
        await connection.query('RELEASE SAVEPOINT smoke_work');
        return result;
      } catch (error) {
        await connection.query('ROLLBACK TO SAVEPOINT smoke_work');
        await connection.query('RELEASE SAVEPOINT smoke_work');
        throw error;
      }
    },
    async close() {},
  };
  // A smoke test must not put rollback-only investigation IDs in the real queue.
  const app = buildApp({ ...config, logLevel: 'silent' }, db, { jobs: {
    async enqueue() { return 'waiting'; }, async ping() {}, async close() {},
  } });
  try {
    const password = randomBytes(24).toString('base64url');
    const email = `smoke-${randomBytes(12).toString('hex')}@example.com`;
    const registration = await completeRegistration(app,{ display_name: 'Temporary smoke test', email, password });
    assert.equal(registration.statusCode, 201, 'Registration failed');
    const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password } });
    assert.equal(login.statusCode, 200, 'Login failed');
    const headers = { authorization: `Bearer ${login.json().access_token}` };
    const me = await app.inject({ method: 'GET', url: '/v1/auth/me', headers });
    assert.equal(me.statusCode, 200, 'Authenticated account lookup failed');
    assert.deepEqual(me.json().user.roles, ['user']);
    assert.ok(me.json().user.permissions.includes('investigations.create'));
    assert.equal((await app.inject({ method: 'GET', url: '/v1/admin/roles', headers })).statusCode, 403);
    assert.equal((await app.inject('/ready')).statusCode, 200);
    const requested = await app.inject({ method: 'POST', url: '/v1/investigations', headers,
      payload: { investigation_type: 'web_analysis', user_prompt: 'Record this submitted reference',
        input_data: { urls: ['https://example.com/'], targets: [{ entity_type: 'website', canonical_name: 'Example',
          identifiers: [{ identifier_type: 'domain', value: 'example.com' }] }] } } });
    assert.equal(requested.statusCode, 202, 'Investigation creation failed');
    const investigationId = requested.json().investigation.investigation_id;
    assert.equal((await collectSubmittedSources(db, investigationId)).outcome, 'collected');
    const sources = await app.inject({ method: 'GET', url: `/v1/investigations/${investigationId}/sources`, headers });
    assert.equal(sources.statusCode, 200);
    assert.equal(sources.json().sources.length, 1);
    assert.equal(sources.json().sources[0].used_in_analysis, false);
    assert.equal((await app.inject({ method: 'POST', url: `/v1/investigations/${investigationId}/cancel`, headers })).statusCode, 200);
    const logout = await app.inject({ method: 'POST', url: '/v1/auth/logout', headers });
    assert.equal(logout.statusCode, 204, 'Logout failed');
    assert.equal((await app.inject({ method: 'GET', url: '/v1/auth/me', headers })).statusCode, 401, 'Logged-out token remained valid');
  } finally {
    await app.close();
  }
  console.log('Live PostgreSQL auth, RBAC, readiness, investigation creation, reference collection, and cancellation checks passed.');
} finally {
  if (client) {
    await client.query('ROLLBACK');
    client.release();
    console.log('Temporary smoke-test database writes rolled back.');
  }
  await pool.end();
}
