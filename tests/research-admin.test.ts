import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { testDatabase } from './support/database.js';

const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: 'postgres://unused:unused@localhost/test', JWT_SECRET: 'test-secret-32-bytes-minimum-long-value' });

test('AI registry APIs enforce permissions, safe configuration and auditing', async t => {
  const { db, postgres } = await testDatabase();
  const app = buildApp(config, db);
  const registration = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: 'registry@example.com', display_name: 'Registry user', password: 'Registry test password long' } });
  const userId = registration.json().user.users_id as string;
  const headers = { authorization: `Bearer ${registration.json().access_token}` };
  const post = (name: string, payload: Record<string, unknown>) => app.inject({ method: 'POST', url: `/v1/admin/ai/${name}`, headers, payload });
  const patch = (name: string, id: string, payload: Record<string, unknown>) => app.inject({ method: 'PATCH', url: `/v1/admin/ai/${name}/${id}`, headers, payload });
  let providerId: string;
  try {
    await t.test('ordinary users cannot read or mutate AI routing', async () => {
      assert.equal((await app.inject({ method: 'GET', url: '/v1/admin/ai/providers', headers })).statusCode, 403);
      assert.equal((await post('providers', { provider_code: 'gemini', display_name: 'Gemini' })).statusCode, 403);
    });
    await db.query("INSERT INTO user_roles (users_id, role_id) SELECT $1, role_id FROM roles WHERE role_key = 'admin'", [userId]);
    await t.test('admins can create providers but cannot set credential references or API keys', async () => {
      const result = await post('providers', { provider_code: 'gemini', display_name: 'Gemini' });
      assert.equal(result.statusCode, 201, result.body); providerId = result.json().entry.provider_id;
      assert.equal((await patch('providers', providerId, { credential_secret_ref: 'env:GEMINI_API_KEY' })).statusCode, 403);
      assert.equal((await patch('providers', providerId, { api_key: 'must-not-be-stored' })).statusCode, 400);
      assert.equal((await post('providers', { provider_code: 'gemini', display_name: 'Duplicate' })).statusCode, 409);
    });
    await db.query("INSERT INTO user_roles (users_id, role_id) SELECT $1, role_id FROM roles WHERE role_key = 'superadmin'", [userId]);
    await t.test('superadmins can select only allowed external secret references', async () => {
      assert.equal((await patch('providers', providerId, { credential_secret_ref: 'env:JWT_SECRET' })).statusCode, 400);
      assert.equal((await patch('providers', providerId, { credential_secret_ref: 'env:GEMINI_API_KEY' })).statusCode, 200);
      await db.query("DELETE FROM user_roles WHERE users_id = $1 AND role_id IN (SELECT role_id FROM roles WHERE role_key = 'superadmin')", [userId]);
      const providers = await app.inject({ method: 'GET', url: '/v1/admin/ai/providers', headers });
      assert.equal(providers.statusCode, 200);
      assert.equal(providers.json().entries[0].credential_secret_ref, undefined);
      assert.equal(providers.json().entries[0].credential_configured, true);
    });
    await t.test('model, agent, task, tool and assignment APIs preserve relationships and constraints', async () => {
      const model = await post('models', { provider_id: providerId, provider_model_id: 'registry-model', display_name: 'Selected model', model_config: { max_output_tokens: 1024 } });
      assert.equal(model.statusCode, 201, model.body);
      assert.equal((await patch('models', model.json().entry.model_id, { model_config: { secret: 'must-not-be-stored' } })).statusCode, 400);
      const agent = await post('agents', { agent_code: 'research', display_name: 'Research', instructions_template: 'Use sources and uncertainty.' });
      assert.equal(agent.statusCode, 201, agent.body);
      const agentId = agent.json().entry.agent_id;
      assert.equal((await patch('agents', agentId, { instructions_template: 'Changed instructions' })).statusCode, 400);
      assert.equal((await patch('agents', agentId, { instructions_template: 'Changed instructions', prompt_version: 'v2' })).statusCode, 200);
      const task = await post('tasks', { task_code: 'investigation_analysis', display_name: 'Analysis' });
      assert.equal(task.statusCode, 201, task.body);
      assert.equal((await post('tasks', { task_code: 'unimplemented_handler', display_name: 'Unsupported' })).statusCode, 400);
      const tool = await post('tools', { tool_code: 'ultrasearch_search', display_name: 'UltraSearch', tool_type: 'external_api', tool_config: { max_results: 3 } });
      assert.equal(tool.statusCode, 201, tool.body);
      assert.equal((await patch('tools', tool.json().entry.tool_id, { tool_type: 'internal' })).statusCode, 400);
      assert.equal((await post('agent-tools', { agent_id: agentId, tool_id: tool.json().entry.tool_id })).statusCode, 200);
      assert.equal((await post('agent-tools', { agent_id: agentId, tool_id: tool.json().entry.tool_id, is_enabled: false })).json().entry.is_enabled, false);
      const assignment = { task_id: task.json().entry.task_id, agent_id: agentId, model_id: model.json().entry.model_id, priority: 1 };
      const first = await post('assignments', assignment);
      assert.equal(first.statusCode, 201, first.body);
      assert.equal((await post('assignments', assignment)).statusCode, 409);
    });
    await t.test('audit failures roll back configuration changes and secrets are absent from audit snapshots', async () => {
      const logs = await db.query('SELECT * FROM admin_audit_logs');
      assert.ok(logs.rows.some(log => log.action === 'ai.providers.update'));
      assert.ok(!JSON.stringify(logs.rows).includes('env:GEMINI_API_KEY'));
      await postgres.exec(`CREATE FUNCTION test_registry_audit_failure() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END; $$ LANGUAGE plpgsql;
        CREATE TRIGGER test_registry_audit_failure BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION test_registry_audit_failure();`);
      try { assert.equal((await patch('providers', providerId, { status: 'disabled' })).statusCode, 500); }
      finally { await postgres.exec('DROP TRIGGER test_registry_audit_failure ON admin_audit_logs; DROP FUNCTION test_registry_audit_failure();'); }
      assert.equal((await db.query('SELECT status FROM ai_providers WHERE provider_id = $1', [providerId])).rows[0]!.status, 'active');
    });
  } finally { await app.close(); await db.close(); }
});
