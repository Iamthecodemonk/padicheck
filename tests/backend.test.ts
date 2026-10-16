import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { QueryResult, QueryResultRow } from 'pg';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { Database, SqlExecutor } from '../src/database/index.js';

const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgresql://unused:unused@localhost/test', JWT_SECRET: 'test-only-secret-32-bytes-minimum-value' });

test('supplied schema and authentication integration', async t => {
  const postgres = new PGlite();
  const sql = await readFile(new URL('../db/migrations/001_baseline.sql', import.meta.url), 'utf8');
  assert.equal(sql, await readFile(new URL('../padicheck_mvp_schema.sql', import.meta.url), 'utf8'));
  await postgres.exec(sql);
  const executor: SqlExecutor = {
    async query<T extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>> {
      const result = await postgres.query<T>(text, values);
      return { rows: result.rows, rowCount: result.affectedRows || result.rows.length, command: '', oid: 0, fields: [] };
    },
  };
  const db: Database = {
    ...executor,
    session: work => work(executor),
    async transaction(work) {
      return postgres.transaction(async tx => work({
        async query<T extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>> {
          const result = await tx.query<T>(text, values);
          return { rows: result.rows, rowCount: result.affectedRows || result.rows.length, command: '', oid: 0, fields: [] };
        },
      }));
    },
    close: () => postgres.close(),
  };
  const app = buildApp(config, db);
  let token: string;
  let userId: string;
  const password = 'A long password for integration!';
  try {
    await t.test('migration includes seeds, triggers and constraint enforcement', async () => {
      assert.equal((await db.query('SELECT * FROM roles')).rows.length, 6);
      await assert.rejects(db.query("INSERT INTO media_files (provider_public_id, provider_resource_type, original_filename, media_type, mime_type, size_bytes) VALUES ('test', 'invalid', 'file', 'document', 'application/pdf', 10)"));
    });
    await t.test('register grants default role and stores only a password hash', async () => {
      const res = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { display_name: 'Ada', email: 'Ada@example.com', password } });
      assert.equal(res.statusCode, 201, res.body);
      token = res.json().access_token;
      userId = res.json().user.users_id;
      assert.equal(res.json().user.password_hash, undefined);
      const hash = (await db.query('SELECT password_hash FROM user_auth_accounts WHERE users_id = $1', [userId])).rows[0]!.password_hash;
      assert.notEqual(hash, password);
      assert.match(hash, /^scrypt\$/);
      const me = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { authorization: `Bearer ${token}` } });
      assert.equal(me.statusCode, 200, me.body);
      assert.deepEqual(me.json().user.roles, ['user']);
      assert.ok(me.json().user.permissions.includes('investigations.create'));
    });
    await t.test('case-insensitive duplicate email rolls back registration', async () => {
      const res = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { display_name: 'Other', email: 'ada@example.com', password } });
      assert.equal(res.statusCode, 409, res.body);
      assert.equal((await db.query('SELECT * FROM users')).rows.length, 1);
      assert.equal((await db.query('SELECT * FROM user_auth_accounts')).rows.length, 1);
    });
    await t.test('login accepts email casing, rejects wrong passwords and records usage', async () => {
      const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'ADA@example.com', password } });
      assert.equal(res.statusCode, 200, res.body);
      assert.ok((await db.query('SELECT last_login_at FROM users')).rows[0]!.last_login_at);
      assert.ok((await db.query('SELECT last_used_at FROM user_auth_accounts')).rows[0]!.last_used_at);
      const invalid = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'ada@example.com', password: 'wrong password long enough' } });
      const unknown = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'missing@example.com', password } });
      assert.equal(invalid.statusCode, 401);
      assert.equal(unknown.statusCode, 401);
      assert.deepEqual(invalid.json().error, unknown.json().error);
    });
    await t.test('authentication rejects missing, tampered and expired tokens', async () => {
      for (const value of ['', token + 'invalid']) {
        const res = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { authorization: `Bearer ${value}` } });
        assert.equal(res.statusCode, 401);
      }
      const { createSigner } = await import('fast-jwt');
      const sign = createSigner({ key: config.jwtSecret, algorithm: 'HS256' });
      const expired = sign({ sub: userId, iss: 'padicheck', aud: 'padicheck-api', exp: 1 });
      assert.equal((await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { authorization: `Bearer ${expired}` } })).statusCode, 401);
    });
    await t.test('RBAC rejects ordinary users and audits superadmin grants', async () => {
      const headers = { authorization: `Bearer ${token}` };
      assert.equal((await app.inject({ method: 'GET', url: '/v1/admin/roles', headers })).statusCode, 403);
      const grantRequest = { method: 'POST' as const, url: `/v1/admin/users/${userId}/roles`, headers, payload: { role_key: 'support' } };
      assert.equal((await app.inject(grantRequest)).statusCode, 403);
      // Give the ordinary role roles.manage and wildcard: it still cannot grant roles.
      await db.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT r.role_id, p.permission_id
        FROM roles r CROSS JOIN permissions p WHERE r.role_key = 'user' AND p.permission_key IN ('roles.manage', '*')`);
      assert.equal((await app.inject(grantRequest)).statusCode, 403);
      assert.equal((await app.inject({ method: 'GET', url: '/v1/admin/roles', headers })).statusCode, 403);
      await db.query("INSERT INTO user_roles (users_id, role_id) SELECT $1, role_id FROM roles WHERE role_key = 'superadmin'", [userId]);
      assert.equal((await app.inject({ method: 'GET', url: '/v1/admin/roles', headers })).statusCode, 200);
      assert.equal((await app.inject(grantRequest)).statusCode, 200);
      const logs = await db.query('SELECT * FROM admin_audit_logs');
      assert.equal(logs.rows.length, 1);
      assert.equal(logs.rows[0]!.actor_user_id, userId);
      assert.equal(logs.rows[0]!.action, 'roles.grant');
      assert.ok(logs.rows[0]!.after_state.roles.includes('support'));
      assert.equal((await app.inject(grantRequest)).json().granted, false);
      assert.equal((await db.query('SELECT * FROM admin_audit_logs')).rows.length, 1);
      await postgres.exec(`CREATE FUNCTION test_reject_audit() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END; $$ LANGUAGE plpgsql;
        CREATE TRIGGER test_reject_audit BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION test_reject_audit();`);
      const failed = await app.inject({ ...grantRequest, payload: { role_key: 'moderator' } });
      assert.equal(failed.statusCode, 500);
      assert.equal((await db.query(`SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.users_id = $1 AND r.role_key = 'moderator'`, [userId])).rows.length, 0);
      await postgres.exec('DROP TRIGGER test_reject_audit ON admin_audit_logs; DROP FUNCTION test_reject_audit();');
      // Changes take effect without reissuing a token.
      await db.query("DELETE FROM user_roles WHERE users_id = $1 AND role_id IN (SELECT role_id FROM roles WHERE role_key = 'superadmin')", [userId]);
      assert.equal((await app.inject(grantRequest)).statusCode, 403);
    });
    await t.test('suspension takes effect for already-issued tokens and login', async () => {
      await db.query("UPDATE users SET account_status = 'suspended' WHERE users_id = $1", [userId]);
      assert.equal((await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { authorization: `Bearer ${token}` } })).statusCode, 401);
      assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'ada@example.com', password } })).statusCode, 401);
    });
    await t.test('validation rejects privilege injection and weak passwords', async () => {
      const res = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { display_name: 'Bad', email: 'bad@example.com', password, roles: ['superadmin'] } });
      assert.equal(res.statusCode, 400, res.body);
      assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { display_name: 'Bad', email: 'bad@example.com', password: 'short' } })).statusCode, 400);
    });
    await t.test('readiness and health work after migration', async () => {
      assert.equal((await app.inject('/ready')).statusCode, 200);
      assert.equal((await app.inject('/health')).statusCode, 200);
    });
    await t.test('authentication endpoints enforce rate limits', async () => {
      let response;
      for (let i = 0; i < 11; i++) response = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: {} });
      assert.equal(response!.statusCode, 429);
    });
  } finally {
    await app.close();
    await postgres.close();
  }
});

test('invalid configuration is rejected', () => {
  const env = { DATABASE_URL: config.databaseUrl, JWT_SECRET: config.jwtSecret };
  assert.throws(() => loadConfig({ ...env, PORT: '0' }), /PORT/);
  assert.throws(() => loadConfig({ ...env, JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.throws(() => loadConfig({ ...env, DATABASE_URL: 'https://example.com' }), /DATABASE_URL/);
});

test('legacy alignment proposal refuses data loss and restores expected schema when empty', async () => {
  const postgres = new PGlite();
  try {
    await postgres.exec(await readFile(new URL('../db/migrations/001_baseline.sql', import.meta.url), 'utf8'));
    const columns = `SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, column_name`;
    const expected = (await postgres.query(columns)).rows;
    await postgres.exec(`ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin'));
      ALTER TABLE media_files DROP COLUMN storage_provider, DROP COLUMN provider_asset_id, DROP COLUMN provider_public_id,
        DROP COLUMN provider_resource_type, DROP COLUMN provider_delivery_type, DROP COLUMN provider_version,
        ADD COLUMN storage_key text NOT NULL UNIQUE;
      ALTER TABLE model_runs DROP COLUMN task_id, DROP COLUMN assignment_id, DROP COLUMN agent_id, DROP COLUMN model_id;
      INSERT INTO users (display_name, email) VALUES ('Legacy', 'legacy@example.com');`);
    const proposal = await readFile(new URL('../db/migrations/002_align_legacy_schema.sql', import.meta.url), 'utf8');
    await assert.rejects(postgres.exec(proposal), /refusing data loss/);
    await postgres.exec('ROLLBACK');
    assert.equal((await postgres.query('SELECT role FROM users')).rows.length, 1);
    await postgres.exec('DELETE FROM users');
    await postgres.exec(proposal);
    assert.deepEqual((await postgres.query(columns)).rows, expected);
    const indexes = (await postgres.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE tablename = 'media_files'")).rows.map(row => row.indexname);
    assert.ok(indexes.includes('uq_media_provider_public_id'));
    assert.ok(!indexes.includes('media_files_storage_key_key'));
    const references = await postgres.query("SELECT conname FROM pg_constraint WHERE conrelid = 'model_runs'::regclass AND contype = 'f'");
    assert.equal(references.rows.length, 5);
  } finally {
    await postgres.close();
  }
});
