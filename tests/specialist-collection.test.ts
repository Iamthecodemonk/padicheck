import assert from 'node:assert/strict';
import { test } from 'node:test';
import { testDatabase } from './support/database.js';
import { buildTestApp, completeRegistration } from './support/auth.js';
import { loadConfig } from '../src/config.js';
import { createInvestigation } from '../src/modules/investigations/service.js';
import { collectSubmittedSources } from '../src/modules/investigations/collector.js';
import { researchOwner } from '../src/modules/research/pipeline.js';
import { collectSpecialistChecks } from '../src/modules/research/specialist-collection.js';
import type { SpecialistAdapter } from '../src/modules/research/specialist-collection.js';
import type { Investigation } from '../src/modules/investigations/types.js';

test('specialist source persistence is private, cached, ownership protected and cancellation aware', async () => {
  const { db, postgres } = await testDatabase();
  const app = buildTestApp(loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: 'postgres://unused/unused', JWT_SECRET: 'specialist-test-secret-32-characters-long' }), db);
  try {
    const owner = (await completeRegistration(app, { email: 'owner@example.test', display_name: 'Owner', password: 'Owner password long enough' })).json();
    const other = (await completeRegistration(app, { email: 'other@example.test', display_name: 'Other', password: 'Other password long enough' })).json();
    const created = await createInvestigation(db, owner.user.users_id, { investigation_type: 'company_research', user_prompt: 'Check supplied business', input_data: {
      check_context: 'business', verification: { business_name: 'Example Ltd', registration_number: 'RC123456', country_code: 'NG' },
    } });
    const id = created.investigation.investigation_id;
    assert.equal((await collectSubmittedSources(db, id)).outcome, 'collected');
    const row = (await db.query<Investigation>('SELECT * FROM investigations WHERE investigation_id=$1', [id])).rows[0]!;
    let calls = 0;
    const adapter: SpecialistAdapter = { signature: 'explicit-test-provider', async run() { calls++; return [{ kind: 'business', provider: 'Test registry', status: 'record_matched',
      checked_at: '2026-10-24T00:00:00Z', summary: 'Supplied details match the test record.', facts: [{ label: 'Number', value: 'RC123456' }], source_url: 'https://example.com/registry' }]; } };
    const authorize = (client?: Parameters<typeof researchOwner>[0]) => client ? researchOwner(client, id) : db.transaction(tx => researchOwner(tx, id));
    await collectSpecialistChecks(db, row, adapter, authorize);
    await collectSpecialistChecks(db, row, adapter, authorize);
    assert.equal(calls, 1);
    const sources = (await db.query('SELECT s.* FROM sources s JOIN investigation_sources l ON l.source_id=s.source_id WHERE l.investigation_id=$1', [id])).rows;
    assert.equal(sources.length, 1); assert.equal(sources[0]!.visibility, 'private');
    assert.equal(sources[0]!.source_type, 'external_api');
    assert.match(sources[0]!.excerpt, /does not establish/);
    const read = await app.inject({ method: 'GET', url: '/v1/investigations/' + id, headers: { authorization: 'Bearer ' + owner.access_token } });
    assert.equal(read.statusCode, 200, read.body);
    assert.equal(read.json().specialist_checks[0].status, 'record_matched');
    const denied = await app.inject({ method: 'GET', url: '/v1/investigations/' + id, headers: { authorization: 'Bearer ' + other.access_token } });
    assert.equal(denied.statusCode, 404);
    const second = await createInvestigation(db, owner.user.users_id, { investigation_type: 'company_research', user_prompt: 'Second test' });
    const secondId = second.investigation.investigation_id;
    await collectSubmittedSources(db, secondId);
    const secondRow = (await db.query<Investigation>('SELECT * FROM investigations WHERE investigation_id=$1', [secondId])).rows[0]!;
    const cancelled: SpecialistAdapter = { ...adapter, async run() { await db.query("UPDATE investigations SET status='cancelled' WHERE investigation_id=$1", [secondId]); return adapter.run(secondRow, async () => {}); } };
    await assert.rejects(collectSpecialistChecks(db, secondRow, cancelled, client => client ? researchOwner(client, secondId) : db.transaction(tx => researchOwner(tx, secondId))), /processing_stopped/);
    assert.equal((await db.query('SELECT 1 FROM investigation_sources WHERE investigation_id=$1', [secondId])).rowCount, 0);
    await collectSpecialistChecks(db, { ...secondRow, investigation_type: 'contract_review' }, adapter, async () => { throw new Error('Contract should bypass checks'); });
  } finally { await app.close(); await postgres.close(); }
});
