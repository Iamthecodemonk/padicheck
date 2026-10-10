import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { Database } from '../src/database/index.js';

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
  const app = buildApp({ ...config, logLevel: 'silent' }, db);
  try {
    const password = randomBytes(24).toString('base64url');
    const email = `smoke-${randomBytes(12).toString('hex')}@example.com`;
    const registration = await app.inject({ method: 'POST', url: '/v1/auth/register',
      payload: { display_name: 'Temporary smoke test', email, password } });
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
    const logout = await app.inject({ method: 'POST', url: '/v1/auth/logout', headers });
    assert.equal(logout.statusCode, 204, 'Logout failed');
    assert.equal((await app.inject({ method: 'GET', url: '/v1/auth/me', headers })).statusCode, 401, 'Logged-out token remained valid');
  } finally {
    await app.close();
  }
  console.log('Live PostgreSQL registration, login, logout, default role, RBAC denial, and readiness checks passed.');
} finally {
  if (client) {
    await client.query('ROLLBACK');
    client.release();
    console.log('Temporary smoke-test database writes rolled back.');
  }
  await pool.end();
}
