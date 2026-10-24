import 'dotenv/config';
import { createDatabase } from '../src/database/index.js';
import { loadConfig } from '../src/config.js';
import { providerJson } from '../src/adapters/provider-http.js';
import { researchReadiness } from '../src/runtime/readiness.js';

// Explicit operator setup. Never grants roles or replaces an existing AI registry.
const model = process.argv[2];
const apply = process.argv[3] === '--apply';
if (!model || !/^[a-z0-9._-]{1,200}$/i.test(model) || process.argv.length > 4 ||
    (process.argv[3] !== undefined && !apply)) throw new Error('Usage: node --import tsx scripts/configure-research.ts <model-id> [--apply]');
const config = loadConfig();
if (!process.env.GEMINI_API_KEY || !config.ultraSearchUrl || !config.redisUrl) throw new Error('Configure Gemini, UltraSearch and Redis first');
const info = await providerJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, {
  headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
});
if (!Array.isArray(info.supportedGenerationMethods) || !info.supportedGenerationMethods.includes('generateContent')) throw new Error('Selected model cannot generate content');
const db = createDatabase(config.databaseUrl);
try {
  if (!apply) {
    console.log(JSON.stringify({ mode: 'preview', model, action: 'Initialize an empty research registry with Gemini, one analysis route, and search/fetch/PDF tools. No roles or credentials are stored.' }));
  } else {
    await db.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [721934203]);
      const tables = ['ai_providers', 'ai_models', 'ai_agents', 'ai_task_types', 'ai_tools', 'ai_task_assignments', 'ai_agent_tools'];
      for (const table of tables) {
        if ((await client.query(`SELECT 1 FROM ${table} LIMIT 1`)).rowCount) throw new Error('Registry is not empty; use authenticated AI administration to preserve existing configuration');
      }
      const provider = (await client.query(`INSERT INTO ai_providers (provider_code,display_name,credential_secret_ref)
        VALUES ('gemini','Gemini','env:GEMINI_API_KEY') RETURNING provider_id`)).rows[0]!.provider_id;
      const modelId = (await client.query(`INSERT INTO ai_models (provider_id,provider_model_id,display_name,model_config)
        VALUES ($1,$2,$2,'{"max_output_tokens":4096}') RETURNING model_id`, [provider, model])).rows[0]!.model_id;
      const agent = (await client.query(`INSERT INTO ai_agents (agent_code,display_name,instructions_template,prompt_version)
        VALUES ('evidence_reviewer','Evidence reviewer','Identify claims, risks, unclear clauses and questions to ask. Use only supplied evidence, cite exact quotations, distinguish source claims from verified facts, and state uncertainty and limitations.','v1') RETURNING agent_id`)).rows[0]!.agent_id;
      const task = (await client.query(`INSERT INTO ai_task_types (task_code,display_name)
        VALUES ('investigation_analysis','Investigation evidence analysis') RETURNING task_id`)).rows[0]!.task_id;
      for (const code of ['ultrasearch_search', 'public_url_fetch', 'pdf_extract']) {
        const tool = (await client.query(`INSERT INTO ai_tools (tool_code,display_name,tool_type,tool_config,credential_secret_ref)
          VALUES ($1,$1,$2,$3::jsonb,$4) RETURNING tool_id`, [code, code === 'ultrasearch_search' ? 'external_api' : 'internal',
          JSON.stringify(code === 'ultrasearch_search' ? { max_results: 5, max_queries: 6, max_sources: 25, max_seconds: 180 } : {}),
          code === 'ultrasearch_search' && process.env.ULTRASEARCH_API_KEY ? 'env:ULTRASEARCH_API_KEY' : null])).rows[0]!.tool_id;
        await client.query('INSERT INTO ai_agent_tools (agent_id,tool_id) VALUES ($1,$2)', [agent, tool]);
      }
      await client.query('INSERT INTO ai_task_assignments (task_id,agent_id,model_id,priority) VALUES ($1,$2,$3,1)', [task, agent, modelId]);
      await client.query(`INSERT INTO admin_audit_logs (action,target_type,target_id,after_state)
        VALUES ('ai_registry.operator_initialize','ai_agent',$1,$2::jsonb)`, [agent, JSON.stringify({ model, prompt_version: 'v1', tools: ['ultrasearch_search', 'public_url_fetch', 'pdf_extract'] })]);
    });
    await researchReadiness(db, { ...config, researchEnabled: true });
    console.log(JSON.stringify({ registry: 'configured', model, readiness: 'passed' }));
  }
} catch {
  console.error('Research registry setup failed. Existing entries are preserved; check configuration and use authenticated administration for an existing registry.');
  process.exitCode = 1;
} finally { await db.close(); }
