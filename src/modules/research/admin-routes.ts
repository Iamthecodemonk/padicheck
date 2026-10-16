import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import { ApiError } from '../../errors.js';

const string = (maxLength = 200) => ({ type: 'string', minLength: 1, maxLength });
const uuid = { type: 'string', format: 'uuid' };
const status = { type: 'string', enum: ['active', 'disabled'] };
const safeModelConfig = { type: 'object', additionalProperties: false, properties: {
  max_output_tokens: { type: 'integer', minimum: 512, maximum: 8192 },
  input_usd_per_million: { type: 'number', minimum: 0, maximum: 10000 },
  output_usd_per_million: { type: 'number', minimum: 0, maximum: 10000 },
} };
const safeToolConfig = { type: 'object', additionalProperties: false, properties: { max_results: { type: 'integer', minimum: 1, maximum: 5 } } };
type Spec = { table: string; id: string; required: string[]; properties: Record<string, unknown>; actor?: boolean };
// Table and column names come only from this fixed allowlist, never from input.
const specs: Record<string, Spec> = {
  providers: { table: 'ai_providers', id: 'provider_id', actor: true, required: ['provider_code', 'display_name'], properties: {
    provider_code: { type: 'string', enum: ['gemini'] }, display_name: string(), status,
    credential_secret_ref: { type: ['string', 'null'], enum: ['env:GEMINI_API_KEY', null] },
  } },
  models: { table: 'ai_models', id: 'model_id', actor: true, required: ['provider_id', 'provider_model_id', 'display_name'], properties: {
    provider_id: uuid, provider_model_id: { ...string(), pattern: '^(models/)?[a-zA-Z0-9._-]+$' }, display_name: string(),
    status: { type: 'string', enum: ['active', 'disabled', 'retired'] }, model_config: safeModelConfig,
  } },
  agents: { table: 'ai_agents', id: 'agent_id', actor: true, required: ['agent_code', 'display_name', 'instructions_template'], properties: {
    agent_code: string(80), display_name: string(), description: string(2000), instructions_template: string(8000), prompt_version: string(64), status,
  } },
  tasks: { table: 'ai_task_types', id: 'task_id', required: ['task_code', 'display_name'], properties: {
    task_code: { type: 'string', enum: ['investigation_analysis'] }, display_name: string(), description: string(2000), is_enabled: { type: 'boolean' },
  } },
  tools: { table: 'ai_tools', id: 'tool_id', required: ['tool_code', 'display_name', 'tool_type'], properties: {
    tool_code: { type: 'string', enum: ['ultrasearch_search', 'public_url_fetch', 'pdf_extract'] }, display_name: string(),
    tool_type: { type: 'string', enum: ['external_api', 'internal'] }, tool_config: safeToolConfig, status,
    credential_secret_ref: { type: ['string', 'null'], enum: ['env:ULTRASEARCH_API_KEY', null] },
  } },
  assignments: { table: 'ai_task_assignments', id: 'assignment_id', actor: true, required: ['task_id', 'agent_id', 'model_id'], properties: {
    task_id: uuid, agent_id: uuid, model_id: uuid, priority: { type: 'integer', minimum: 1, maximum: 100 },
    is_enabled: { type: 'boolean' }, config_override: { type: 'object', additionalProperties: false,
      properties: { max_output_tokens: { type: 'integer', minimum: 512, maximum: 8192 } } },
  } },
};
const jsonConfigKeys = new Set(['max_output_tokens', 'input_usd_per_million', 'output_usd_per_million', 'max_results']);
function sanitize(row: Record<string, unknown>, superadmin: boolean) {
  const result = { ...row };
  if ('credential_secret_ref' in result && !superadmin) {
    result.credential_configured = !!result.credential_secret_ref;
    delete result.credential_secret_ref;
  }
  for (const key of ['model_config', 'tool_config', 'config_override', 'tool_config_override']) {
    if (result[key] && typeof result[key] === 'object') {
      result[key] = Object.fromEntries(Object.entries(result[key] as Record<string, unknown>).filter(([name, value]) =>
        jsonConfigKeys.has(name) && typeof value === 'number' && Number.isFinite(value)));
    }
  }
  return result;
}
function mapDatabaseError(error: unknown): never {
  const code = (error as { code?: string }).code;
  if (code === '23505') throw new ApiError(409, 'registry_conflict', 'Registry entry or enabled priority already exists');
  if (code === '23503' || code === '23514') throw new ApiError(400, 'invalid_registry_reference', 'Registry references or settings are invalid');
  throw error;
}

export async function researchAdminRoutes(app: FastifyInstance, db: Database, access: Authorization) {
  const guard = access.requirePermission('ai_config.manage');
  app.get<{ Querystring: { agent_id?: string; limit?: number; offset?: number } }>('/v1/admin/ai/agent-tools', {
    onRequest: guard, schema: { querystring: { type: 'object', additionalProperties: false, properties: {
      agent_id: uuid, limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }, offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 },
    } } },
  }, async (request, reply) => {
    const result = await db.query(`SELECT agent_id, tool_id, is_enabled FROM ai_agent_tools
      WHERE ($1::uuid IS NULL OR agent_id = $1) ORDER BY agent_id, tool_id LIMIT $2 OFFSET $3`,
    [request.query.agent_id ?? null, request.query.limit ?? 50, request.query.offset ?? 0]);
    reply.header('Cache-Control', 'no-store');
    return { entries: result.rows };
  });
  for (const [name, spec] of Object.entries(specs)) {
    const columns = [spec.id, ...Object.keys(spec.properties)];
    const columnSql = columns.join(', ');
    app.get<{ Querystring: { limit?: number; offset?: number } }>(`/v1/admin/ai/${name}`, {
      onRequest: guard, schema: { querystring: { type: 'object', additionalProperties: false, properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }, offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 },
      } } },
    }, async (request, reply) => {
      const found = await db.query(`SELECT ${columnSql} FROM ${spec.table} ORDER BY ${spec.id} LIMIT $1 OFFSET $2`, [request.query.limit ?? 50, request.query.offset ?? 0]);
      reply.header('Cache-Control', 'no-store');
      return { entries: found.rows.map(row => sanitize(row, request.principal!.roles.includes('superadmin'))) };
    });
    for (const method of ['POST', 'PATCH'] as const) {
      app.route<{ Body: Record<string, unknown>; Params: { id: string } }>({
        method, url: `/v1/admin/ai/${name}${method === 'PATCH' ? '/:id' : ''}`, onRequest: guard,
        schema: { ...(method === 'PATCH' ? { params: { type: 'object', required: ['id'], properties: { id: uuid } } } : {}),
          body: { type: 'object', additionalProperties: false, minProperties: 1,
            required: method === 'POST' ? spec.required : [], properties: spec.properties } },
        async handler(request, reply) {
          const superadmin = request.principal!.roles.includes('superadmin');
          if ('credential_secret_ref' in request.body && !superadmin) throw new ApiError(403, 'superadmin_required', 'Only superadmins can change credential references');
          if (name === 'tools' && request.body.tool_code && request.body.tool_type &&
              request.body.tool_type !== (request.body.tool_code === 'ultrasearch_search' ? 'external_api' : 'internal')) {
            throw new ApiError(400, 'invalid_tool_type', 'Tool type does not match the supported adapter');
          }
          try {
            const row = await db.transaction(async client => {
              let before: Record<string, unknown> | null = null;
              if (method === 'PATCH') {
                before = (await client.query(`SELECT ${columnSql} FROM ${spec.table} WHERE ${spec.id} = $1 FOR UPDATE`, [request.params.id])).rows[0] ?? null;
                if (!before) throw new ApiError(404, 'registry_not_found', 'Registry entry was not found');
                // Prompt edits require a distinct version to keep execution records meaningful.
                if (name === 'agents' && 'instructions_template' in request.body && request.body.instructions_template !== before.instructions_template &&
                    (!request.body.prompt_version || request.body.prompt_version === before.prompt_version)) {
                  throw new ApiError(400, 'prompt_version_required', 'Changing instructions requires a new prompt version');
                }
              }
              if (name === 'tools') {
                const code = request.body.tool_code ?? before?.tool_code;
                const type = request.body.tool_type ?? before?.tool_type;
                if (type !== (code === 'ultrasearch_search' ? 'external_api' : 'internal')) {
                  throw new ApiError(400, 'invalid_tool_type', 'Tool type does not match the supported adapter');
                }
              }
              const keys = Object.keys(request.body);
              const values = keys.map(key => typeof request.body[key] === 'object' && request.body[key] !== null ? JSON.stringify(request.body[key]) : request.body[key]);
              let after: Record<string, unknown>;
              if (method === 'POST') {
                if (spec.actor) { keys.push('created_by_user_id'); values.push(request.principal!.users_id); }
                after = (await client.query(`INSERT INTO ${spec.table} (${keys.join(', ')}) VALUES (${values.map((_value, index) => `$${index + 1}`).join(', ')}) RETURNING ${columnSql}`, values)).rows[0]!;
              } else {
                values.push(request.params.id);
                after = (await client.query(`UPDATE ${spec.table} SET ${keys.map((key, index) => `${key} = $${index + 1}`).join(', ')}
                  WHERE ${spec.id} = $${values.length} RETURNING ${columnSql}`, values)).rows[0]!;
              }
              await client.query(`INSERT INTO admin_audit_logs (actor_user_id, action, target_type, target_id, before_state, after_state, request_id)
                VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`, [request.principal!.users_id, `ai.${name}.${method === 'POST' ? 'create' : 'update'}`,
                spec.table, after[spec.id], before ? JSON.stringify(sanitize(before, false)) : null, JSON.stringify(sanitize(after, false)), request.id]);
              return after;
            });
            reply.header('Cache-Control', 'no-store');
            return reply.code(method === 'POST' ? 201 : 200).send({ entry: sanitize(row, superadmin) });
          } catch (error) { mapDatabaseError(error); }
        },
      });
    }
  }

  app.post<{ Body: { agent_id: string; tool_id: string; is_enabled?: boolean } }>('/v1/admin/ai/agent-tools', {
    onRequest: guard, schema: { body: { type: 'object', additionalProperties: false, required: ['agent_id', 'tool_id'],
      properties: { agent_id: uuid, tool_id: uuid, is_enabled: { type: 'boolean', default: true } } } },
  }, async (request, reply) => {
    try {
      const row = await db.transaction(async client => {
        const agent = await client.query('SELECT agent_id FROM ai_agents WHERE agent_id = $1 FOR UPDATE', [request.body.agent_id]);
        if (!agent.rowCount) throw new ApiError(404, 'registry_not_found', 'Agent was not found');
        const before = (await client.query('SELECT agent_id, tool_id, is_enabled FROM ai_agent_tools WHERE agent_id = $1 AND tool_id = $2',
          [request.body.agent_id, request.body.tool_id])).rows[0] ?? null;
        const after = (await client.query(`INSERT INTO ai_agent_tools (agent_id, tool_id, is_enabled) VALUES ($1,$2,$3)
          ON CONFLICT (agent_id, tool_id) DO UPDATE SET is_enabled = EXCLUDED.is_enabled RETURNING agent_id, tool_id, is_enabled`,
        [request.body.agent_id, request.body.tool_id, request.body.is_enabled ?? true])).rows[0]!;
        await client.query(`INSERT INTO admin_audit_logs (actor_user_id, action, target_type, target_id, before_state, after_state, request_id)
          VALUES ($1,'ai.agent_tools.set','ai_agent_tools',$2,$3::jsonb,$4::jsonb,$5)`, [request.principal!.users_id, request.body.agent_id,
          before ? JSON.stringify(before) : null, JSON.stringify(after), request.id]);
        return after;
      });
      reply.header('Cache-Control', 'no-store');
      return { entry: row };
    } catch (error) { mapDatabaseError(error); }
  });
}
