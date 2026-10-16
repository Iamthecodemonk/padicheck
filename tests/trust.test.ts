import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildTestApp as buildApp, completeRegistration } from './support/auth.js';
import { loadConfig } from '../src/config.js';
import { testDatabase } from './support/database.js';
import type { MediaStorage } from '../src/modules/media/types.js';

const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: 'postgres://unused:unused@localhost/test', JWT_SECRET: 'test-secret-32-bytes-minimum-long-value' });

test('directory and trust APIs preserve privacy, role boundaries and transactional decisions', async t => {
  const { db, postgres } = await testDatabase();
  let deliveries = 0;
  const storage: MediaStorage = { async upload() { throw new Error('Not used'); }, async destroy() {},
    download() { deliveries++; return 'https://example.com/signed-test'; } };
  const app = buildApp(config, db, { storage });
  async function actor(name: string, role?: string) {
    const result = await completeRegistration(app,{ display_name: name, email: `${name}@example.com`, password: 'Long enough testing password!' });
    assert.equal(result.statusCode, 201, result.body);
    const id = result.json().user.users_id as string;
    if (role) await db.query('INSERT INTO user_roles (users_id,role_id) SELECT $1,role_id FROM roles WHERE role_key = $2', [id,role]);
    return { id, headers: { authorization: `Bearer ${result.json().access_token}` } };
  }
  const owner = await actor('owner'); const other = await actor('other');
  const admin = await actor('admin','admin'); const verifier = await actor('verifier','verifier');
  const moderator = await actor('moderator','moderator'); const support = await actor('support','support');
  const post = (url: string, who: typeof owner, payload?: Record<string, unknown>) => app.inject({ method: 'POST', url, headers: who.headers, ...(payload ? { payload } : {}) });
  const get = (url: string, who?: typeof owner) => app.inject({ method: 'GET', url, headers: who?.headers });
  const business = await post('/v1/admin/businesses', admin, { canonical_name: 'Sample Business', business_category: 'services', profile_description: 'Business profile', country_code: 'NG' });
  assert.equal(business.statusCode, 201, business.body);
  const profile = business.json().business; const id = profile.business_profile_id as string; const entity = profile.entity_id as string;
  const publish = () => post(`/v1/admin/businesses/${id}/publication`, admin, { status: 'published', note: 'Editorial review completed' });
  async function media(user = owner, visibility = 'private', status = 'ready') {
    return (await db.query(`INSERT INTO media_files (uploaded_by_user_id,provider_public_id,provider_resource_type,provider_version,
      original_filename,media_type,mime_type,size_bytes,upload_status,visibility) VALUES ($1,$2,'raw',1,'evidence.pdf','document','application/pdf',100,$3,$4) RETURNING media_id`,
    [user.id, randomUUID(), status, visibility])).rows[0]!.media_id as string;
  }
  const privateMedia = await media(); const unrelated = await media(); const stolen = await media(other);
  let verificationId: string; let reportId: string; let disputeId: string;
  try {
    await t.test('drafts are private and anonymous writes fail', async () => {
      assert.equal((await get(`/v1/directory/${id}`)).statusCode, 404);
      assert.deepEqual((await get('/v1/directory')).json().businesses, []);
      assert.equal((await app.inject({ method: 'POST', url: '/v1/reports', payload: {} })).statusCode, 401);
      assert.equal((await post('/v1/admin/businesses', owner, { canonical_name: 'Unauthorized', business_category: 'test' })).statusCode, 403);
      assert.equal((await post(`/v1/admin/businesses/${id}/publication`, verifier, { status: 'published', note: 'No permission' })).statusCode, 403);
      assert.equal((await publish()).statusCode, 200);
    });
    await t.test('public directory exposes only published fields and public identifiers', async () => {
      for (const visibility of ['private','restricted','public']) await db.query(`INSERT INTO identifiers (entity_id,identifier_type,value,normalized_value,visibility)
        VALUES ($1,'email',$2,$2,$3)`, [entity, `${visibility}@sample.test`, visibility]);
      const result = await get(`/v1/directory/${id}`);
      assert.equal(result.statusCode, 200);
      assert.equal(result.json().business.claimed_by_user_id, undefined);
      assert.deepEqual(result.json().identifiers, [{ identifier_type: 'email', value: 'public@sample.test' }]);
      assert.equal((await get('/v1/directory?q=Sample&category=services')).json().businesses.length, 1);
      assert.equal((await get('/v1/directory?limit=101')).statusCode, 400);
    });
    await t.test('business edits cannot grant ownership or bypass publication permission', async () => {
      for (const payload of [{ claimed_by_user_id: owner.id }, { profile_status: 'published' }]) {
        assert.equal((await app.inject({ method: 'PATCH', url: `/v1/admin/businesses/${id}`, headers: admin.headers, payload })).statusCode, 400);
      }
      assert.equal((await post('/v1/admin/businesses', admin, { entity_id: entity, business_category: 'duplicate' })).statusCode, 409);
      const response = await app.inject({ method: 'PATCH', url: `/v1/admin/businesses/${id}`, headers: admin.headers, payload: { profile_description: 'Edited profile' } });
      assert.equal(response.statusCode, 200, response.body);
    });
    await t.test('verification submissions require owned ready private evidence and prevent duplicates', async () => {
      for (const mediaIds of [[], [stolen], [await media(owner,'public')], [await media(owner,'private','failed')], [privateMedia,privateMedia.toUpperCase()]]) {
        assert.equal((await post('/v1/verifications', owner, { business_profile_id: id, media_ids: mediaIds })).statusCode, 400);
      }
      const response = await post('/v1/verifications', owner, { business_profile_id: id, media_ids: [privateMedia] });
      assert.equal(response.statusCode, 201, response.body); verificationId = response.json().verification.verification_request_id;
      assert.equal((await post('/v1/verifications', owner, { business_profile_id: id, media_ids: [privateMedia] })).statusCode, 409);
      assert.equal((await get(`/v1/verifications/${verificationId}`, other)).statusCode, 404);
      assert.equal((await get(`/v1/verifications/${verificationId}`, verifier)).json().evidence.length, 1);
      assert.equal((await get('/v1/admin/verifications', support)).statusCode, 403);
    });
    await t.test('evidence access is scoped to linked uploads and review permission; deletion stays owner-only', async () => {
      assert.equal((await get(`/v1/media/${privateMedia}`, verifier)).statusCode, 200);
      assert.equal((await post(`/v1/media/${privateMedia}/delivery`, verifier)).statusCode, 200);
      assert.equal((await post(`/v1/media/${privateMedia}/delivery`, moderator)).statusCode, 404);
      assert.equal((await post(`/v1/media/${unrelated}/delivery`, verifier)).statusCode, 404);
      assert.equal((await app.inject({ method: 'DELETE', url: `/v1/media/${privateMedia}`, headers: verifier.headers })).statusCode, 404);
      assert.equal((await app.inject({ method: 'DELETE', url: `/v1/media/${privateMedia}`, headers: owner.headers })).statusCode, 409);
      assert.equal(deliveries, 1);
    });
    await t.test('verification decisions enforce roles, terminal states and no self review', async () => {
      const review = { status: 'approved', note: 'Submitted evidence supports the business claim' };
      assert.equal((await post(`/v1/admin/verifications/${verificationId}/review`, owner, review)).statusCode, 403);
      await db.query("INSERT INTO user_roles (users_id,role_id) SELECT $1,role_id FROM roles WHERE role_key = 'verifier'", [owner.id]);
      assert.equal((await post(`/v1/admin/verifications/${verificationId}/review`, owner, review)).statusCode, 403);
      const response = await post(`/v1/admin/verifications/${verificationId}/review`, verifier, review);
      assert.equal(response.statusCode, 200, response.body);
      assert.equal((await db.query('SELECT claimed_by_user_id FROM business_profiles WHERE business_profile_id = $1', [id])).rows[0]!.claimed_by_user_id, owner.id);
      assert.equal((await post(`/v1/admin/verifications/${verificationId}/review`, verifier, review)).statusCode, 409);
      assert.equal((await post(`/v1/verifications/${verificationId}/withdraw`, owner)).statusCode, 409);
      assert.equal((await post('/v1/verifications', other, { business_profile_id: id, media_ids: [stolen] })).statusCode, 409);
      assert.equal((await get(`/v1/directory/${id}`)).json().verification_review.status, 'approved');
    });
    await t.test('private entity identifiers cannot be used to submit reports', async () => {
      const privateEntity = (await db.query("INSERT INTO entities (entity_type,canonical_name) VALUES ('person','Private target') RETURNING entity_id")).rows[0]!.entity_id;
      assert.equal((await post('/v1/reports', owner, { entity_id: privateEntity, title: 'Claim', description: 'Private entity report', report_category: 'conduct' })).statusCode, 404);
    });
    await t.test('reports remain separate allegations and only moderation publishes them', async () => {
      const response = await post('/v1/reports', other, { entity_id: entity, title: 'Service complaint', description: 'A user allegation', report_category: 'service', media_ids: [stolen] });
      assert.equal(response.statusCode, 201, response.body); reportId = response.json().report.user_report_id;
      assert.deepEqual((await get(`/v1/directory/${id}/reports`)).json().reports, []);
      assert.equal((await get(`/v1/reports/${reportId}`, owner)).statusCode, 404);
      assert.equal((await get(`/v1/reports/${reportId}`, moderator)).json().evidence.length, 1);
      assert.equal((await post(`/v1/media/${stolen}/delivery`, moderator)).statusCode, 200);
      assert.equal((await post(`/v1/admin/reports/${reportId}/review`, verifier, { status: 'published', note: 'No permission' })).statusCode, 403);
      const result = await post(`/v1/admin/reports/${reportId}/review`, moderator, { status: 'published', note: 'Reviewed as a user allegation' });
      assert.equal(result.statusCode, 200, result.body);
      const publicReport = (await get(`/v1/directory/${id}/reports`)).json();
      assert.equal(publicReport.reports.length, 1);
      for (const name of ['submitted_by_user_id','reviewed_by_user_id','moderation_note','evidence']) assert.equal(publicReport.reports[0][name], undefined);
      assert.match(publicReport.limitations[0], /allegations/);
      assert.equal(Number((await db.query('SELECT count(*) AS count FROM findings')).rows[0]!.count), 0);
    });
    await t.test('business owners cannot moderate reports about their business', async () => {
      await db.query("INSERT INTO user_roles (users_id,role_id) SELECT $1,role_id FROM roles WHERE role_key = 'moderator'", [owner.id]);
      assert.equal((await post(`/v1/admin/reports/${reportId}/review`, owner, { status: 'rejected', note: 'Conflict of interest' })).statusCode, 403);
    });
    await t.test('disputes require visible published reports, protect privacy and prevent duplicates', async () => {
      const response = await post(`/v1/reports/${reportId}/disputes`, owner, { reason: 'This allegation needs further review' });
      assert.equal(response.statusCode, 201, response.body); disputeId = response.json().dispute.dispute_id;
      assert.equal((await post(`/v1/reports/${reportId}/disputes`, owner, { reason: 'Duplicate' })).statusCode, 409);
      assert.equal((await get(`/v1/disputes/${disputeId}`, other)).statusCode, 404);
      assert.equal((await get(`/v1/disputes/${disputeId}`, moderator)).statusCode, 200);
      assert.equal((await get('/v1/admin/disputes', verifier)).statusCode, 403);
      assert.equal((await post(`/v1/admin/disputes/${disputeId}/review`, owner, { status: 'resolved', note: 'Self review', report_action: 'keep' })).statusCode, 403);
    });
    await t.test('audit failure rolls back dispute, report status and moderation history together', async () => {
      await postgres.exec(`CREATE FUNCTION trust_audit_failure() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test failure'; END; $$ LANGUAGE plpgsql;
        CREATE TRIGGER trust_audit_failure BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION trust_audit_failure();`);
      const count = (await db.query('SELECT count(*) FROM moderation_actions')).rows[0]!.count;
      try {
        assert.equal((await post(`/v1/admin/disputes/${disputeId}/review`, moderator, { status: 'resolved', report_action: 'unpublish', note: 'Needs further evidence' })).statusCode, 500);
      } finally { await postgres.exec('DROP TRIGGER trust_audit_failure ON admin_audit_logs; DROP FUNCTION trust_audit_failure();'); }
      assert.equal((await db.query('SELECT status FROM report_disputes WHERE dispute_id = $1', [disputeId])).rows[0]!.status, 'submitted');
      assert.equal((await db.query('SELECT status FROM user_reports WHERE user_report_id = $1', [reportId])).rows[0]!.status, 'published');
      assert.equal((await db.query('SELECT count(*) FROM moderation_actions')).rows[0]!.count, count);
    });
    await t.test('dispute resolution explicitly controls unpublishing and records history', async () => {
      assert.equal((await post(`/v1/admin/disputes/${disputeId}/review`, moderator, { status: 'resolved', note: 'Missing report action' })).statusCode, 400);
      const response = await post(`/v1/admin/disputes/${disputeId}/review`, moderator, { status: 'resolved', report_action: 'unpublish', note: 'Needs further evidence' });
      assert.equal(response.statusCode, 200, response.body);
      assert.ok(response.json().dispute.resolved_at);
      assert.deepEqual((await get(`/v1/directory/${id}/reports`)).json().reports, []);
      assert.equal((await post(`/v1/admin/disputes/${disputeId}/review`, moderator, { status: 'rejected', note: 'Already final' })).statusCode, 409);
      assert.equal((await post(`/v1/reports/${reportId}/disputes`, owner, { reason: 'No longer public' })).statusCode, 404);
      const actions = (await db.query('SELECT action_type FROM moderation_actions WHERE user_report_id = $1', [reportId])).rows.map(row => row.action_type);
      assert.ok(actions.includes('dispute_unpublish'));
      const logs = (await db.query("SELECT action FROM admin_audit_logs WHERE action IN ('businesses.claim','reports.dispute_unpublish','disputes.review')")).rows;
      assert.equal(logs.length, 3);
    });
    await t.test('withdrawals cannot be undone by moderation or expose withdrawn submissions', async () => {
      assert.equal((await post(`/v1/reports/${reportId}/withdraw`, other)).statusCode, 200);
      assert.equal((await post(`/v1/admin/reports/${reportId}/review`, moderator, { status: 'published', note: 'Attempt to restore' })).statusCode, 409);
      assert.equal((await post(`/v1/admin/businesses/${id}/publication`, admin, { status: 'hidden', note: 'Hide entry' })).statusCode, 200);
      assert.equal((await get(`/v1/directory/${id}`)).statusCode, 404);
      assert.equal((await get(`/v1/directory/${id}/reports`)).statusCode, 404);
      assert.equal((await get('/ready')).statusCode, 200);
    });
  } finally { await app.close(); await db.close(); }
});
