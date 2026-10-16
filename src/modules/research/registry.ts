import type { Database } from '../../database/index.js';
import { ResearchError, type Assignment } from './types.js';

export const researchTaskCode = 'investigation_analysis';
export async function researchAssignments(db: Database): Promise<Assignment[]> {
  const result = await db.query<Assignment>(`SELECT a.assignment_id, t.task_id, t.task_code, ag.agent_id, m.model_id,
    p.provider_code, p.credential_secret_ref, m.provider_model_id, ag.instructions_template, ag.prompt_version,
    a.priority, m.model_config, a.config_override FROM ai_task_assignments a
    JOIN ai_task_types t ON t.task_id = a.task_id JOIN ai_agents ag ON ag.agent_id = a.agent_id
    JOIN ai_models m ON m.model_id = a.model_id JOIN ai_providers p ON p.provider_id = m.provider_id
    WHERE t.task_code = $1 AND t.is_enabled AND a.is_enabled AND ag.status = 'active'
      AND m.status = 'active' AND p.status = 'active' ORDER BY a.priority LIMIT 3`, [researchTaskCode]);
  return result.rows;
}

export async function permittedTools(db: Database, agentId: string) {
  const result = await db.query<{ tool_code: string; credential_secret_ref: string | null; tool_config: Record<string, unknown> }>(`
    SELECT tool.tool_code, tool.credential_secret_ref, tool.tool_config || link.tool_config_override AS tool_config
    FROM ai_agent_tools link JOIN ai_tools tool ON tool.tool_id = link.tool_id
    WHERE link.agent_id = $1 AND link.is_enabled AND tool.status = 'active'`, [agentId]);
  const tools = new Map(result.rows.map(row => [row.tool_code, row]));
  return {
    get(code: string) {
      const tool = tools.get(code);
      if (!tool) throw new ResearchError('required_tool_unconfigured');
      return tool;
    },
  };
}
