import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './support/database.js';
import { collectSubmittedSources } from '../src/modules/investigations/collector.js';
import { createInvestigation } from '../src/modules/investigations/service.js';
import { runResearch } from '../src/modules/research/pipeline.js';
import { ResearchError, type ResearchAdapters, type Evidence } from '../src/modules/research/types.js';
import { buildTestApp as buildApp, completeRegistration } from './support/auth.js';
import { loadConfig } from '../src/config.js';
import { hashContent } from '../src/adapters/research.js';

const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: 'postgres://unused:unused@localhost/test',
  JWT_SECRET: 'test-secret-32-bytes-minimum-long-value', RESEARCH_ENABLED: 'true' });

test('registry-driven research, priority fallback, evidence, and cancellation', async t => {
  const { db, postgres } = await testDatabase();
  const app = buildApp(config, db);
  const registration = await completeRegistration(app,{
    email: 'research@example.com', display_name: 'Research user', password: 'Research password long enough',
  });
  assert.equal(registration.statusCode, 201, registration.body);
  const ownerId = registration.json().user.users_id as string;
  const token = registration.json().access_token as string;
  const provider = (await db.query(`INSERT INTO ai_providers (provider_code, display_name, credential_secret_ref)
    VALUES ('gemini','Test Gemini','env:GEMINI_API_KEY') RETURNING provider_id`)).rows[0]!.provider_id;
  const agent = (await db.query(`INSERT INTO ai_agents (agent_code, display_name, instructions_template)
    VALUES ('test_research','Research agent','Assess evidence and state uncertainty') RETURNING agent_id`)).rows[0]!.agent_id;
  const task = (await db.query(`INSERT INTO ai_task_types (task_code, display_name) VALUES ('investigation_analysis','Analysis') RETURNING task_id`)).rows[0]!.task_id;
  for (const code of ['ultrasearch_search', 'public_url_fetch', 'pdf_extract']) {
    const tool = (await db.query(`INSERT INTO ai_tools (tool_code, display_name, tool_type) VALUES ($1,$1,$2) RETURNING tool_id`,
      [code, code === 'ultrasearch_search' ? 'external_api' : 'internal'])).rows[0]!.tool_id;
    await db.query('INSERT INTO ai_agent_tools (agent_id, tool_id) VALUES ($1,$2)', [agent, tool]);
  }
  for (const [index, model] of ['fixture-primary', 'fixture-fallback'].entries()) {
    const created = (await db.query(`INSERT INTO ai_models (provider_id, provider_model_id, display_name, model_config)
      VALUES ($1,$2,$2,'{"input_usd_per_million":1,"output_usd_per_million":2}'::jsonb) RETURNING model_id`, [provider, model])).rows[0]!.model_id;
    await db.query('INSERT INTO ai_task_assignments (task_id, agent_id, model_id, priority) VALUES ($1,$2,$3,$4)', [task, agent, created, index + 1]);
  }
  let mode: 'ok' | 'fallback' | 'invalid' | 'cancel' | 'disable' = 'ok';
  let currentId = '';
  let modelCalls: string[] = [];
  let searchCalls = 0;
  const sourceText = 'The page lists a business contact address. This is a self-published statement, not independent verification.';
  const output = (evidence: Evidence[]) => ({ summary: 'The page lists contact information that needs independent confirmation.', limitations: ['Only the retrieved excerpts were considered.'],
    findings: [{ finding_type: 'claim', category: 'contact', title: 'Contact details are listed', explanation: 'A source lists contact details; identity and legitimacy remain unverified.', confidence: 0.6,
      evidence: [{ source_id: mode === 'invalid' ? randomUUID() : evidence[0]!.source_id, quote: evidence[0]!.excerpt.slice(0, 32), support_type: 'supports' }] }] });
  const adapters: ResearchAdapters = {
    async search() { searchCalls++; return [{ url: 'https://search.example/result', title: 'Search result', snippet: 'A partial search result.' }]; },
    async fetchPage(url) { return { url, title: 'Public page', text: sourceText, truncated: false }; },
    async downloadDocument() { return Buffer.from('%PDF-fixture'); },
    async extractPdf() { return { text: 'The contract requires an upfront processing fee before work begins.', pages: 1, truncated: false }; },
    async analyze(assignment, _question, evidence) {
      modelCalls.push(assignment.provider_model_id);
      if (mode === 'fallback' && assignment.priority === 1) throw new ResearchError('provider_request_failed');
      if (mode === 'cancel') await db.query("UPDATE investigations SET status = 'cancelled', completed_at = now() WHERE investigation_id = $1", [currentId]);
      if (mode === 'disable') await db.query("UPDATE ai_providers SET status = 'disabled' WHERE provider_id = $1", [provider]);
      return { output: output(evidence), inputTokens: 23, outputTokens: 7, requestId: 'fixture-request-id' };
    },
  };
  async function request() {
    const created = await createInvestigation(db, ownerId, { investigation_type: 'web_analysis', user_prompt: 'Assess the submitted company references', input_data: { urls: ['https://submitted.example/'] } });
    currentId = created.investigation.investigation_id;
    modelCalls = [];
    assert.equal((await collectSubmittedSources(db, currentId)).outcome, 'collected');
    return currentId;
  }
  try {
    await t.test('research publishes evidence-backed unverified findings atomically', async () => {
      const id = await request();
      assert.equal((await runResearch(db, id, adapters)).outcome, 'completed');
      const row = (await db.query('SELECT * FROM investigations WHERE investigation_id = $1', [id])).rows[0]!;
      assert.equal(row.status, 'completed'); assert.ok(row.completed_at);
      assert.match(row.result_summary, /not independent verification/);
      const findings = await db.query('SELECT * FROM findings WHERE investigation_id = $1', [id]);
      assert.equal(findings.rows.length, 1); assert.equal(findings.rows[0]!.verification_status, 'unverified');
      const runs = await db.query('SELECT * FROM model_runs WHERE investigation_id = $1', [id]);
      assert.equal(runs.rows[0]!.model_name, 'fixture-primary');
      assert.equal(runs.rows[0]!.status, 'succeeded');
      assert.equal(runs.rows[0]!.input_tokens, 23);
      assert.equal(Number(runs.rows[0]!.estimated_cost_usd), 0.000037);
      const sources = await db.query(`SELECT s.*, link.used_in_analysis FROM sources s JOIN investigation_sources link ON link.source_id = s.source_id WHERE link.investigation_id = $1`, [id]);
      assert.equal(sources.rows.length, 2);
      assert.ok(sources.rows.every(source => source.visibility === 'private' && source.used_in_analysis && source.fetched_at));
      const read = await app.inject({ method: 'GET', url: `/v1/investigations/${id}/findings`, headers: { authorization: `Bearer ${token}` } });
      assert.equal(read.statusCode, 200, read.body);
      assert.equal(read.json().findings[0].sources.length, 1);
      assert.ok(read.json().findings[0].sources[0].url);
      // A duplicate completed job cannot append findings or bill another model call.
      assert.equal((await runResearch(db, id, adapters)).outcome, 'ignored');
      assert.deepEqual(modelCalls, ['fixture-primary']);
    });
    await t.test('fallback follows active assignment priority and preserves failed execution records', async () => {
      mode = 'fallback'; const id = await request();
      assert.equal((await runResearch(db, id, adapters)).outcome, 'completed');
      assert.deepEqual(modelCalls, ['fixture-primary', 'fixture-fallback']);
      const runs = await db.query('SELECT status, error_code, model_name FROM model_runs WHERE investigation_id = $1 ORDER BY created_at, model_run_id', [id]);
      assert.equal(runs.rows.length, 2);
      assert.ok(runs.rows.some(run => run.model_name === 'fixture-primary' && run.status === 'failed' && run.error_code === 'provider_request_failed'));
      assert.ok(runs.rows.some(run => run.model_name === 'fixture-fallback' && run.status === 'succeeded'));
    });
    await t.test('foreign or hallucinated source IDs never produce findings', async () => {
      mode = 'invalid'; const id = await request();
      assert.equal((await runResearch(db, id, adapters)).outcome, 'failed');
      assert.equal((await db.query('SELECT 1 FROM findings WHERE investigation_id = $1', [id])).rows.length, 0);
      assert.ok((await db.query('SELECT error_code FROM model_runs WHERE investigation_id = $1', [id])).rows.every(run => run.error_code === 'invalid_model_output'));
    });
    await t.test('cancellation during provider work discards output while retaining run metadata', async () => {
      mode = 'cancel'; const id = await request();
      assert.equal((await runResearch(db, id, adapters)).outcome, 'ignored');
      assert.equal((await db.query('SELECT status FROM investigations WHERE investigation_id = $1', [id])).rows[0]!.status, 'cancelled');
      assert.equal((await db.query('SELECT 1 FROM findings WHERE investigation_id = $1', [id])).rows.length, 0);
      const run = (await db.query('SELECT status, input_tokens, error_code FROM model_runs WHERE investigation_id = $1', [id])).rows[0]!;
      assert.equal(run.status, 'failed'); assert.equal(run.input_tokens, 23); assert.equal(run.error_code, 'processing_stopped');
    });
    await t.test('disabling a route during inference prevents publication', async () => {
      mode = 'disable'; const id = await request();
      assert.equal((await runResearch(db, id, adapters)).outcome, 'failed');
      assert.equal((await db.query('SELECT 1 FROM findings WHERE investigation_id = $1', [id])).rows.length, 0);
      await db.query("UPDATE ai_providers SET status = 'active' WHERE provider_id = $1", [provider]);
    });
    await t.test('disabled tools and absent assignments fail without making model calls', async () => {
      mode = 'ok'; const id = await request();
      await db.query("UPDATE ai_tools SET status = 'disabled' WHERE tool_code = 'ultrasearch_search'");
      assert.equal((await runResearch(db, id, adapters)).error_code, 'required_tool_unconfigured');
      assert.deepEqual(modelCalls, []);
      await db.query("UPDATE ai_tools SET status = 'active'");
      const next = await request();
      await db.query('UPDATE ai_task_types SET is_enabled = false WHERE task_id = $1', [task]);
      assert.equal((await runResearch(db, next, adapters)).error_code, 'analysis_not_configured');
      await db.query('UPDATE ai_task_types SET is_enabled = true WHERE task_id = $1', [task]);
    });
    await t.test('contract analysis extracts authenticated documents without sending contract text to search', async () => {
      mode = 'ok';
      const mediaId = randomUUID();
      await db.query(`INSERT INTO media_files (media_id, uploaded_by_user_id, provider_public_id, provider_resource_type,
        original_filename, media_type, mime_type, size_bytes, sha256, upload_status)
        VALUES ($1,$2,$3,'raw','contract.pdf','document','application/pdf',12,$4,'ready')`, [mediaId, ownerId, randomUUID() + '.pdf', hashContent(Buffer.from('%PDF-fixture'))]);
      const created = await createInvestigation(db, ownerId, { investigation_type: 'contract_review', user_prompt: 'Identify unclear clauses and questions to ask.', input_data: { media_ids: [mediaId] } });
      const id = created.investigation.investigation_id;
      await collectSubmittedSources(db, id);
      const beforeSearch = searchCalls;
      assert.equal((await runResearch(db, id, adapters)).outcome, 'completed');
      assert.equal(searchCalls, beforeSearch);
      const source = (await db.query(`SELECT s.* FROM sources s JOIN investigation_sources link ON link.source_id = s.source_id WHERE link.investigation_id = $1`, [id])).rows[0]!;
      assert.equal(source.metadata.content_kind, 'pdf_text');
      assert.equal(source.metadata.pages, 1);
      assert.equal(source.url, null);
      const second = await createInvestigation(db, ownerId, { investigation_type: 'contract_review', user_prompt: 'Review this document.', input_data: { media_ids: [mediaId] } });
      await collectSubmittedSources(db, second.investigation.investigation_id);
      const extract = adapters.extractPdf;
      const beforeModel = modelCalls.length;
      adapters.extractPdf = async () => { throw new ResearchError('pdf_text_unavailable'); };
      try { assert.equal((await runResearch(db, second.investigation.investigation_id, adapters)).error_code, 'no_readable_evidence'); }
      finally { adapters.extractPdf = extract; }
      assert.equal(modelCalls.length, beforeModel);
    });
    await t.test('finding publication rolls back if evidence-link insertion fails', async () => {
      const id = await request();
      await postgres.exec(`CREATE FUNCTION test_finding_link_failure() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test finding link failure'; END; $$ LANGUAGE plpgsql;
        CREATE TRIGGER test_finding_link_failure BEFORE INSERT ON finding_sources FOR EACH ROW EXECUTE FUNCTION test_finding_link_failure();`);
      try { assert.equal((await runResearch(db, id, adapters)).outcome, 'failed'); }
      finally { await postgres.exec('DROP TRIGGER test_finding_link_failure ON finding_sources; DROP FUNCTION test_finding_link_failure();'); }
      assert.equal((await db.query('SELECT 1 FROM findings WHERE investigation_id = $1', [id])).rows.length, 0);
      assert.equal((await db.query("SELECT 1 FROM model_runs WHERE investigation_id = $1 AND status = 'succeeded'", [id])).rows.length, 0);
    });
    await t.test('findings retain investigation ownership protections', async () => {
      const other = await completeRegistration(app,{ email: 'other-research@example.com', display_name: 'Other', password: 'Research password long enough' });
      assert.equal((await app.inject({ method: 'GET', url: `/v1/investigations/${currentId}/findings`, headers: { authorization: `Bearer ${other.json().access_token}` } })).statusCode, 404);
    });
  } finally { await app.close(); await db.close(); }
});
