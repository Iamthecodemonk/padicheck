import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createDatabase, type Database } from '../src/database/index.js';
import { buildTestApp as buildApp, completeRegistration } from '../tests/support/auth.js';
import { loadConfig } from '../src/config.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const base = new URL(process.env.DATABASE_URL);
const adminUrl = new URL(base); adminUrl.pathname = '/postgres';
const name = `padicheck_trust_test_${randomBytes(8).toString('hex')}`;
if (!/^padicheck_trust_test_[a-f0-9]{16}$/.test(name)) throw new Error('Unsafe scratch database name');
const admin = new pg.Pool({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 });
let created = false; let db: Database | undefined; let app: ReturnType<typeof buildApp> | undefined;
try {
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  const scratchUrl = new URL(base); scratchUrl.pathname = '/' + name;
  db = createDatabase(scratchUrl.toString());
  await db.query(await readFile(new URL('../db/migrations/001_baseline.sql', import.meta.url), 'utf8'));
  app = buildApp(loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: scratchUrl.toString(), JWT_SECRET: randomBytes(32).toString('hex') }), db);
  const api = app; const scratch = db;
  async function actor(label: string, role?: string) {
    const response = await completeRegistration(api,{ display_name: label, email: `${label}@example.test`, password: 'Smoke test password long enough' });
    assert.equal(response.statusCode, 201);
    const id = response.json().user.users_id as string;
    if (role) await scratch.query('INSERT INTO user_roles (users_id,role_id) SELECT $1,role_id FROM roles WHERE role_key = $2', [id,role]);
    return { id, headers: { authorization: `Bearer ${response.json().access_token}` } };
  }
  const staff = await actor('staff','admin'); const first = await actor('first'); const second = await actor('second');
  const post = (url: string, who: typeof first, payload: Record<string, unknown>) => api.inject({ method: 'POST', url, headers: who.headers, payload });
  const createdBusiness = await post('/v1/admin/businesses', staff, { canonical_name: 'Trust smoke business', business_category: 'services' });
  assert.equal(createdBusiness.statusCode, 201);
  const business = createdBusiness.json().business;
  assert.equal((await post(`/v1/admin/businesses/${business.business_profile_id}/publication`, staff, { status: 'published', note: 'Smoke publish' })).statusCode, 200);
  async function evidence(userId: string) {
    return (await scratch.query(`INSERT INTO media_files (uploaded_by_user_id,provider_public_id,provider_resource_type,
      original_filename,media_type,mime_type,size_bytes,upload_status) VALUES ($1,$2,'raw','evidence.pdf','document','application/pdf',100,'ready') RETURNING media_id`,
    [userId, randomUUID()])).rows[0]!.media_id as string;
  }
  const firstMedia = await evidence(first.id); const secondMedia = await evidence(second.id);
  const input = { business_profile_id: business.business_profile_id, media_ids: [firstMedia] };
  const duplicate = await Promise.all([post('/v1/verifications', first, input), post('/v1/verifications', first, input)]);
  assert.deepEqual(duplicate.map(result => result.statusCode).sort(), [201,409]);
  const requestOne = duplicate.find(result => result.statusCode === 201)!.json().verification.verification_request_id;
  const requestTwo = await post('/v1/verifications', second, { business_profile_id: business.business_profile_id, media_ids: [secondMedia] });
  assert.equal(requestTwo.statusCode, 201);
  const competing = await Promise.all([requestOne, requestTwo.json().verification.verification_request_id].map(id =>
    post(`/v1/admin/verifications/${id}/review`, staff, { status: 'approved', note: 'Competing approval test' })));
  assert.deepEqual(competing.map(result => result.statusCode).sort(), [200,409]);
  assert.equal(Number((await scratch.query("SELECT count(*) FROM business_verification_requests WHERE status = 'approved'")).rows[0]!.count), 1);
  const report = await post('/v1/reports', first, { entity_id: business.entity_id, report_category: 'service', title: 'Smoke allegation', description: 'This is an unverified test allegation', media_ids: [firstMedia] });
  assert.equal(report.statusCode, 201);
  const reportId = report.json().report.user_report_id;
  assert.equal((await post(`/v1/admin/reports/${reportId}/review`, staff, { status: 'published', note: 'Reviewed allegation' })).statusCode, 200);
  const dispute = await post(`/v1/reports/${reportId}/disputes`, second, { reason: 'Needs further review' });
  assert.equal(dispute.statusCode, 201);
  const resolveUrl = `/v1/admin/disputes/${dispute.json().dispute.dispute_id}/review`;
  await scratch.query(`CREATE FUNCTION smoke_trust_audit_failure() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test failure'; END; $$ LANGUAGE plpgsql;
    CREATE TRIGGER smoke_trust_audit_failure BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION smoke_trust_audit_failure();`);
  try {
    assert.equal((await post(resolveUrl, staff, { status: 'resolved', report_action: 'unpublish', note: 'Rollback check' })).statusCode, 500);
  } finally { await scratch.query('DROP TRIGGER smoke_trust_audit_failure ON admin_audit_logs; DROP FUNCTION smoke_trust_audit_failure();'); }
  assert.equal((await scratch.query('SELECT status FROM user_reports WHERE user_report_id = $1', [reportId])).rows[0]!.status, 'published');
  assert.equal((await post(resolveUrl, staff, { status: 'resolved', report_action: 'unpublish', note: 'Further evidence needed' })).statusCode, 200);
  assert.equal((await api.inject({ url: `/v1/directory/${business.business_profile_id}/reports` })).json().reports.length, 0);
  console.log('Live PostgreSQL trust lifecycle, concurrent submissions/approvals and audit rollback passed. No external provider calls.');
} catch (error) {
  console.error('Trust smoke failed:', (error as { code?: string }).code ?? 'validation_or_configuration_error');
  process.exitCode = 1;
} finally {
  if (app) await app.close();
  if (db) await db.close();
  try { if (created) { await admin.query(`DROP DATABASE "${name}"`); console.log('Removed the generated trust smoke database.'); } }
  finally { await admin.end(); }
}
