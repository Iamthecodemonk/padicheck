import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createDatabase, type Database } from '../src/database/index.js';
import { createInvestigation } from '../src/modules/investigations/service.js';
import { collectSubmittedSources } from '../src/modules/investigations/collector.js';
import { runResearch } from '../src/modules/research/pipeline.js';
import type { ResearchAdapters } from '../src/modules/research/types.js';

// Requires CREATEDB on the configured role. Never reset the configured database.
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const base = new URL(process.env.DATABASE_URL);
const adminUrl = new URL(base); adminUrl.pathname = '/postgres';
const name = `padicheck_research_test_${randomBytes(8).toString('hex')}`;
if (!/^padicheck_research_test_[a-f0-9]{16}$/.test(name)) throw new Error('Unsafe scratch database name');
const admin = new pg.Pool({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 });
let created = false;
let db: Database | undefined;
try {
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  const scratchUrl = new URL(base); scratchUrl.pathname = '/' + name;
  db = createDatabase(scratchUrl.toString());
  await db.query(await readFile(new URL('../db/migrations/001_baseline.sql', import.meta.url), 'utf8'));
  const user = (await db.query("INSERT INTO users (display_name,email) VALUES ('Research smoke','smoke@example.com') RETURNING users_id")).rows[0]!.users_id;
  const provider = (await db.query("INSERT INTO ai_providers (provider_code,display_name,credential_secret_ref) VALUES ('gemini','Fixture provider','env:GEMINI_API_KEY') RETURNING provider_id")).rows[0]!.provider_id;
  const model = (await db.query("INSERT INTO ai_models (provider_id,provider_model_id,display_name) VALUES ($1,'fixture-model','Fixture model') RETURNING model_id", [provider])).rows[0]!.model_id;
  const agent = (await db.query("INSERT INTO ai_agents (agent_code,display_name,instructions_template) VALUES ('fixture','Fixture agent','Use evidence and acknowledge uncertainty') RETURNING agent_id")).rows[0]!.agent_id;
  const task = (await db.query("INSERT INTO ai_task_types (task_code,display_name) VALUES ('investigation_analysis','Analysis') RETURNING task_id")).rows[0]!.task_id;
  await db.query('INSERT INTO ai_task_assignments (task_id,agent_id,model_id) VALUES ($1,$2,$3)', [task, agent, model]);
  for (const code of ['ultrasearch_search', 'public_url_fetch']) {
    const tool = (await db.query('INSERT INTO ai_tools (tool_code,display_name,tool_type) VALUES ($1,$1,$2) RETURNING tool_id',
      [code, code === 'ultrasearch_search' ? 'external_api' : 'internal'])).rows[0]!.tool_id;
    await db.query('INSERT INTO ai_agent_tools (agent_id,tool_id) VALUES ($1,$2)', [agent, tool]);
  }
  const requested = await createInvestigation(db, user, { investigation_type: 'web_analysis', user_prompt: 'Assess the available references.', input_data: { urls: ['https://example.com/'] } });
  const id = requested.investigation.investigation_id;
  const scratch = db;
  await scratch.session(async first => {
    assert.equal((await first.query<{ acquired: boolean }>('SELECT pg_try_advisory_lock(hashtextextended($1,73)) AS acquired', [id])).rows[0]!.acquired, true);
    try {
      await scratch.session(async second => assert.equal((await second.query<{ acquired: boolean }>('SELECT pg_try_advisory_lock(hashtextextended($1,73)) AS acquired', [id])).rows[0]!.acquired, false));
    } finally { await first.query('SELECT pg_advisory_unlock(hashtextextended($1,73))', [id]); }
  });
  const adapters: ResearchAdapters = {
    async search() { return []; },
    async fetchPage(url) { return { url, title: 'Fixture page', text: 'The page lists a contact address.', truncated: false }; },
    async downloadDocument() { throw new Error('Not used in this smoke test'); },
    async extractPdf() { throw new Error('Not used in this smoke test'); },
    async analyze(_assignment, _question, evidence) { return { inputTokens: 15, outputTokens: 8, output: {
      summary: 'A contact address is listed; this remains unverified.', limitations: ['Only one fixture source was assessed.'],
      findings: [{ finding_type: 'claim', category: 'contact', title: 'Address listed', explanation: 'The page makes a contact claim.', confidence: null,
        evidence: [{ source_id: evidence[0]!.source_id, quote: 'The page lists a contact address.', support_type: 'supports' }] }],
    } }; },
  };
  await collectSubmittedSources(db, id);
  assert.equal((await runResearch(db, id, adapters)).outcome, 'completed');
  assert.equal((await db.query('SELECT verification_status FROM findings WHERE investigation_id = $1', [id])).rows[0]!.verification_status, 'unverified');
  assert.equal((await db.query('SELECT status FROM model_runs WHERE investigation_id = $1', [id])).rows[0]!.status, 'succeeded');
  assert.equal((await runResearch(db, id, adapters)).outcome, 'ignored');
  console.log('Live PostgreSQL registry, advisory-lock exclusion, research lifecycle, execution records and evidence links passed using provider doubles.');
} catch (error) {
  console.error('Research smoke failed:', (error as { code?: string }).code ?? 'validation_or_configuration_error');
  process.exitCode = 1;
} finally {
  if (db) await db.close();
  if (created) { await admin.query(`DROP DATABASE "${name}"`); console.log('Removed the generated research smoke database.'); }
  await admin.end();
}
