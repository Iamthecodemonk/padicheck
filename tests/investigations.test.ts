import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildTestApp as buildApp, completeRegistration } from './support/auth.js';
import { loadConfig } from '../src/config.js';
import { collectSubmittedSources } from '../src/modules/investigations/collector.js';
import { processCollectionJob } from '../src/modules/investigations/process-job.js';
import { reconcileInvestigations } from '../src/modules/investigations/reconcile.js';
import { failCollection, revisionSql } from '../src/modules/investigations/service.js';
import type { InvestigationJobs, CreateInvestigation, QueueState } from '../src/modules/investigations/types.js';
import { testDatabase } from './support/database.js';

const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: 'postgres://unused:unused@localhost/test',
  JWT_SECRET: 'test-secret-32-bytes-minimum-long-value' });

test('investigation APIs, durable dispatch, and reference collection', async t => {
  const { db, postgres } = await testDatabase();
  const dispatched: { id: string; restart: boolean; revision: string }[] = [];
  let queueFails = false;
  let queueState: QueueState = 'waiting';
  const jobs: InvestigationJobs = {
    async enqueue(id, restart, revision) {
      if (queueFails) throw new Error('Redis unavailable with secret connection text');
      dispatched.push({ id, restart, revision }); return queueState;
    },
    async ping() {}, async close() {},
  };
  const app = buildApp(config, db, { jobs });
  const account = async (email: string) => {
    const result = await completeRegistration(app,{ email, display_name: email.split('@')[0]!, password: 'Investigation test password long' });
    assert.equal(result.statusCode, 201, result.body);
    return { id: result.json().user.users_id as string, token: result.json().access_token as string };
  };
  const owner = await account('owner@example.com');
  const other = await account('other@example.com');
  const staff = await account('staff@example.com');
  const headers = (token = owner.token) => ({ authorization: `Bearer ${token}` });
  let requestNumber = 1;
  const create = (payload: unknown, token = owner.token) => app.inject({ method: 'POST', url: '/v1/investigations', headers: headers(token),
    payload: payload as Record<string, unknown>, remoteAddress: `127.0.0.${requestNumber++}` });
  const general = (urls: string[] = []): CreateInvestigation => ({ investigation_type: 'general_research', user_prompt: 'Review these submitted references', input_data: { urls } });
  const media = async (userId: string, status = 'ready', type = 'document') => {
    const id = randomUUID();
    await db.query(`INSERT INTO media_files (media_id, uploaded_by_user_id, provider_asset_id, provider_public_id,
      provider_resource_type, original_filename, media_type, mime_type, size_bytes, sha256, upload_status)
      VALUES ($1, $2, $3, $3, 'raw', 'contract.pdf', $4, 'application/pdf', 100, 'test-content-hash', $5)`, [id, userId, randomUUID(), type, status]);
    return id;
  };
  let id: string;
  let documentId: string;
  try {
    await t.test('create is protected and accepts no client-controlled status or owner', async () => {
      assert.equal((await app.inject({ method: 'POST', url: '/v1/investigations', payload: general() })).statusCode, 401);
      assert.equal((await create({ ...general(), status: 'completed' })).statusCode, 400);
      assert.equal((await create({ ...general(), user_id: other.id })).statusCode, 400);
      await db.query("DELETE FROM user_roles WHERE users_id = $1", [staff.id]);
      await db.query("INSERT INTO user_roles (users_id, role_id) SELECT $1, role_id FROM roles WHERE role_key = 'support'", [staff.id]);
      assert.equal((await create(general(), staff.token)).statusCode, 403);
    });
    await t.test('create persists exact schema relationships and dispatches only an ID/revision', async () => {
      documentId = await media(owner.id);
      const res = await create({ investigation_type: 'company_research', title: ' Example company ', user_prompt: ' Check these details ',
        input_data: { urls: ['https://EXAMPLE.com/#section', 'https://example.com/'], media_ids: [documentId], targets: [{ entity_type: 'business', canonical_name: ' Example ',
          target_role: 'primary', identifiers: [
            { identifier_type: 'phone', value: '+234 801-234-5678' },
            { identifier_type: 'phone', value: '+2348012345678' },
            { identifier_type: 'email', value: 'HELLO@EXAMPLE.COM' },
          ] }] } });
      assert.equal(res.statusCode, 202, res.body);
      const row = res.json().investigation;
      id = row.investigation_id;
      assert.equal(row.status, 'queued');
      assert.equal(row.user_id, owner.id);
      assert.equal(row.title, 'Example company');
      assert.equal(row.started_at, null);
      assert.equal(row.completed_at, null);
      assert.equal(row.dispatch_revision, undefined);
      assert.deepEqual(row.input_data.urls, ['https://example.com/']);
      assert.equal(res.json().dispatch, 'queued');
      assert.equal(dispatched.at(-1)!.id, id);
      assert.equal(dispatched.at(-1)!.restart, true);
      const target = (await db.query('SELECT * FROM investigation_targets WHERE investigation_id = $1', [id])).rows[0]!;
      assert.equal(target.target_role, 'primary');
      const identifiers = await db.query('SELECT * FROM identifiers WHERE entity_id = $1 ORDER BY identifier_type', [target.entity_id]);
      assert.equal(identifiers.rows.length, 2);
      assert.equal(identifiers.rows[0]!.normalized_value, 'hello@example.com');
      assert.equal(identifiers.rows[1]!.normalized_value, '+2348012345678');
      assert.ok(identifiers.rows.every(identifier => identifier.visibility === 'private'));
    });
    await t.test('request validation rejects invalid URLs and incomplete typed inputs', async () => {
      for (const payload of [general(['javascript:alert(1)']), general(['https://user:password@example.com/']),
        { ...general(), user_prompt: '   ' }, { investigation_type: 'web_analysis', user_prompt: 'Review site' },
        { investigation_type: 'contract_review', user_prompt: 'Review contract' },
        { investigation_type: 'phone_lookup', user_prompt: 'Find references', input_data: { targets: [{ entity_type: 'person', canonical_name: 'Phone', identifiers: [{ identifier_type: 'phone', value: '08012345678' }] }] } },
      ]) assert.equal((await create(payload)).statusCode, 400);
    });
    await t.test('only owned ready documents can be attached', async () => {
      const foreign = await media(other.id);
      const pending = await media(owner.id, 'pending');
      const image = await media(owner.id, 'ready', 'image');
      const before = (await db.query('SELECT count(*)::int AS total FROM investigations')).rows[0]!.total;
      for (const mediaId of [foreign, pending, image, randomUUID()]) {
        const res = await create({ investigation_type: 'contract_review', user_prompt: 'Review contract', input_data: { media_ids: [mediaId] } });
        assert.equal(res.statusCode, 400, res.body);
      }
      assert.equal((await db.query('SELECT count(*)::int AS total FROM investigations')).rows[0]!.total, before);
    });
    await t.test('own/all scopes protect lists, details, targets and sources', async () => {
      assert.equal((await app.inject({ method: 'GET', url: `/v1/investigations/${id}`, headers: headers(other.token) })).statusCode, 404);
      assert.equal((await app.inject({ method: 'GET', url: `/v1/investigations/${id}/sources`, headers: headers(other.token) })).statusCode, 404);
      const own = await app.inject({ method: 'GET', url: '/v1/investigations', headers: headers(other.token) });
      assert.deepEqual(own.json().investigations, []);
      assert.equal((await app.inject({ method: 'GET', url: '/v1/investigations?scope=all', headers: headers(other.token) })).statusCode, 403);
      const all = await app.inject({ method: 'GET', url: '/v1/investigations?scope=all', headers: headers(staff.token) });
      assert.equal(all.statusCode, 200, all.body);
      assert.ok(all.json().investigations.some((row: { investigation_id: string }) => row.investigation_id === id));
      assert.equal((await app.inject({ method: 'GET', url: `/v1/investigations/${id}`, headers: headers(staff.token) })).statusCode, 200);
      assert.equal((await app.inject({ method: 'POST', url: `/v1/investigations/${id}/cancel`, headers: headers(staff.token) })).statusCode, 403);
    });
    await t.test('background collection is private, honest and idempotent', async () => {
      assert.equal((await collectSubmittedSources(db, id)).outcome, 'collected');
      assert.equal((await collectSubmittedSources(db, id)).outcome, 'collected');
      const detail = await app.inject({ method: 'GET', url: `/v1/investigations/${id}`, headers: headers() });
      assert.equal(detail.json().source_collection_complete, true);
      assert.equal(detail.json().investigation.status, 'collecting_sources');
      assert.ok(detail.json().investigation.started_at);
      assert.equal(detail.json().investigation.completed_at, null);
      assert.equal(detail.json().investigation.result_summary, null);
      assert.equal(detail.json().targets.length, 1);
      const response = await app.inject({ method: 'GET', url: `/v1/investigations/${id}/sources`, headers: headers() });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().sources.length, 2);
      for (const source of response.json().sources) {
        assert.equal(source.visibility, 'private');
        assert.equal(source.used_in_analysis, false);
        assert.equal(source.discovery_method, 'user_submission');
        assert.equal(source.fetched_at, null);
        assert.equal(source.metadata.content_retrieved, false);
      }
      assert.equal((await db.query('SELECT count(*)::int AS total FROM findings')).rows[0]!.total, 0);
      assert.equal((await app.inject({ method: 'DELETE', url: `/v1/media/${documentId}`, headers: headers() })).statusCode, 409);
    });
    await t.test('cancellation wins over repeated jobs and is idempotent', async () => {
      const cancel = await app.inject({ method: 'POST', url: `/v1/investigations/${id}/cancel`, headers: headers() });
      assert.equal(cancel.statusCode, 200, cancel.body);
      assert.equal(cancel.json().investigation.status, 'cancelled');
      assert.ok(cancel.json().investigation.completed_at);
      assert.equal((await collectSubmittedSources(db, id)).outcome, 'ignored');
      assert.equal((await app.inject({ method: 'POST', url: `/v1/investigations/${id}/cancel`, headers: headers() })).statusCode, 200);
      assert.equal((await app.inject({ method: 'POST', url: `/v1/investigations/${id}/retry`, headers: headers() })).statusCode, 409);
      assert.equal((await app.inject({ method: 'POST', url: `/v1/investigations/${id}/cancel`, headers: headers(other.token) })).statusCode, 404);
    });
    await t.test('queue outages preserve requests and reconciliation dispatches them later', async () => {
      queueFails = true;
      const response = await create(general(['https://example.org/input']));
      assert.equal(response.statusCode, 202);
      assert.equal(response.json().dispatch, 'deferred');
      const queuedId = response.json().investigation.investigation_id;
      assert.equal((await db.query('SELECT status FROM investigations WHERE investigation_id = $1', [queuedId])).rows[0]!.status, 'queued');
      queueFails = false;
      await reconcileInvestigations(db, jobs);
      assert.ok(dispatched.some(entry => entry.id === queuedId));
      assert.ok(!dispatched.slice(-1).some(entry => entry.id === id));
    });
    await t.test('deleted attachments fail safely; only owner can retry a failed request', async () => {
      const document = await media(owner.id);
      const response = await create({ investigation_type: 'contract_review', user_prompt: 'Review uploaded contract', input_data: { media_ids: [document] } });
      const requestId = response.json().investigation.investigation_id;
      await db.query("UPDATE media_files SET upload_status = 'deleted' WHERE media_id = $1", [document]);
      assert.equal((await collectSubmittedSources(db, requestId)).error_code, 'invalid_document');
      assert.equal((await app.inject({ method: 'POST', url: `/v1/investigations/${requestId}/retry`, headers: headers(other.token) })).statusCode, 404);
      await db.query("UPDATE media_files SET upload_status = 'ready' WHERE media_id = $1", [document]);
      const retry = await app.inject({ method: 'POST', url: `/v1/investigations/${requestId}/retry`, headers: headers() });
      assert.equal(retry.statusCode, 202, retry.body);
      assert.equal(retry.json().investigation.error_code, null);
      assert.equal(retry.json().investigation.started_at, null);
      let stamp = '';
      const job = { data: { investigation_id: requestId, dispatch_revision: 'old' },
        async updateData(data: { investigation_id: string; dispatch_revision: string }) { stamp = data.dispatch_revision; job.data = data; } };
      assert.equal((await processCollectionJob(db, job)).outcome, 'collected');
      assert.notEqual(stamp, 'old');
    });
    await t.test('worker rechecks account and permission changes', async () => {
      const accountFailure = (await create(general(), other.token)).json().investigation.investigation_id;
      await db.query("UPDATE users SET account_status = 'suspended' WHERE users_id = $1", [other.id]);
      assert.equal((await collectSubmittedSources(db, accountFailure)).error_code, 'account_unavailable');
      await db.query("UPDATE users SET account_status = 'active' WHERE users_id = $1", [other.id]);
      const permissionFailure = (await create(general(), other.token)).json().investigation.investigation_id;
      await db.query('DELETE FROM user_roles WHERE users_id = $1', [other.id]);
      assert.equal((await collectSubmittedSources(db, permissionFailure)).error_code, 'permission_revoked');
    });
    await t.test('collection failure rolls back sources and can be marked failed without defeating cancellation', async () => {
      const requestId = (await create(general(['https://example.net/first', 'https://example.net/fail']))).json().investigation.investigation_id;
      await postgres.exec(`CREATE FUNCTION test_collection_failure() RETURNS trigger AS $$ BEGIN
        IF NEW.url LIKE '%/fail' THEN RAISE EXCEPTION 'test source failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
        CREATE TRIGGER test_collection_failure BEFORE INSERT ON sources FOR EACH ROW EXECUTE FUNCTION test_collection_failure();`);
      try { await assert.rejects(collectSubmittedSources(db, requestId), /test source failure/); }
      finally { await postgres.exec('DROP TRIGGER test_collection_failure ON sources; DROP FUNCTION test_collection_failure();'); }
      assert.equal((await db.query('SELECT 1 FROM investigation_sources WHERE investigation_id = $1', [requestId])).rows.length, 0);
      const row = (await db.query(`SELECT status, ${revisionSql} AS revision FROM investigations WHERE investigation_id = $1`, [requestId])).rows[0]!;
      assert.equal(row.status, 'queued');
      await failCollection(db, requestId, 'source_collection_failed', row.revision);
      assert.equal((await db.query('SELECT status FROM investigations WHERE investigation_id = $1', [requestId])).rows[0]!.status, 'failed');
      await app.inject({ method: 'POST', url: `/v1/investigations/${requestId}/retry`, headers: headers() });
      // An event from the older failed attempt must not fail the new revision.
      await failCollection(db, requestId, 'stale_failure', row.revision);
      assert.equal((await db.query('SELECT status FROM investigations WHERE investigation_id = $1', [requestId])).rows[0]!.status, 'queued');
      await app.inject({ method: 'POST', url: `/v1/investigations/${requestId}/cancel`, headers: headers() });
      await failCollection(db, requestId, 'stale_failure', row.revision);
      assert.equal((await db.query('SELECT status FROM investigations WHERE investigation_id = $1', [requestId])).rows[0]!.status, 'cancelled');
    });
    await t.test('list pagination preserves timestamp precision and has no duplicates', async () => {
      await db.query("UPDATE investigations SET created_at = '2026-10-16T10:00:00.123456Z' WHERE user_id = $1", [owner.id]);
      const seen = new Set<string>();
      let cursor: string | null = null;
      do {
        const pageUrl: string = `/v1/investigations?limit=2${cursor ? `&cursor=${cursor}` : ''}`;
        const response = await app.inject({ method: 'GET', url: pageUrl, headers: headers() });
        assert.equal(response.statusCode, 200, response.body);
        for (const row of response.json().investigations) {
          assert.ok(!seen.has(row.investigation_id)); seen.add(row.investigation_id);
          assert.equal(row.user_prompt, undefined);
        }
        cursor = response.json().next_cursor;
      } while (cursor);
      const expected = await db.query('SELECT investigation_id FROM investigations WHERE user_id = $1', [owner.id]);
      assert.equal(seen.size, expected.rows.length);
      assert.equal((await app.inject({ method: 'GET', url: '/v1/investigations?cursor=invalid', headers: headers() })).statusCode, 400);
    });
    await t.test('reconciliation marks exhausted jobs failed without endlessly retrying them', async () => {
      queueState = 'failed';
      await reconcileInvestigations(db, jobs);
      assert.equal((await db.query("SELECT 1 FROM investigations WHERE status IN ('queued', 'collecting_sources')")).rows.length, 0);
      queueState = 'waiting';
    });
    await t.test('reconciliation keyset pages do not starve requests beyond the first hundred', async () => {
      await db.query(`INSERT INTO investigations (user_id, investigation_type, user_prompt)
        SELECT $1, 'general_research', 'Reconciliation pagination test' FROM generate_series(1, 105)`, [owner.id]);
      const before = dispatched.length;
      const cursor = await reconcileInvestigations(db, jobs);
      assert.ok(cursor);
      assert.equal(await reconcileInvestigations(db, jobs, cursor), undefined);
      assert.equal(new Set(dispatched.slice(before).map(entry => entry.id)).size, 105);
    });
  } finally { await app.close(); await db.close(); }
});
