import type { Database } from '../database/index.js';
import type { AppConfig } from '../config.js';
import { researchAssignments, permittedTools } from '../modules/research/registry.js';

export async function databaseReadiness(db: Database) {
  await db.query(`SELECT u.users_id, a.auth_account_id, r.role_id, ur.users_id,
    p.permission_id, rp.role_id, m.provider_asset_id, m.provider_public_id,
    m.provider_resource_type, m.provider_delivery_type, m.provider_version, m.upload_status
    FROM users u, user_auth_accounts a, roles r, user_roles ur,
    permissions p, role_permissions rp, media_files m LIMIT 0`);
  await db.query(`SELECT i.investigation_id, i.user_id, i.status, i.input_data, e.entity_id,
    ident.identifier_id, target.investigation_target_id, s.source_id, link.used_in_analysis
    FROM investigations i, entities e, identifiers ident, investigation_targets target,
    sources s, investigation_sources link LIMIT 0`);
  await db.query(`SELECT p.provider_id, m.provider_model_id, a.instructions_template, task.task_code, tool.tool_code,
    agent_tool.is_enabled, assignment.priority, run.prompt_version, finding.verification_status, evidence.source_id
    FROM ai_providers p, ai_models m, ai_agents a, ai_task_types task, ai_tools tool, ai_agent_tools agent_tool,
    ai_task_assignments assignment, model_runs run, findings finding, finding_sources evidence LIMIT 0`);
  await db.query(`SELECT b.business_profile_id, v.verification_request_id, ve.media_id, r.user_report_id,
    re.media_id, action.moderation_action_id, d.dispute_id
    FROM business_profiles b, business_verification_requests v, verification_evidence ve,
    user_reports r, user_report_evidence re, moderation_actions action, report_disputes d LIMIT 0`);
  await db.query('SELECT share_link_id,investigation_id,created_by_user_id,token_hash,expires_at,revoked_at FROM investigation_share_links LIMIT 0');
}

export async function researchReadiness(db: Database, config: AppConfig, env: NodeJS.ProcessEnv = process.env) {
  if (!config.researchEnabled) return;
  if (!config.redisUrl || !config.ultraSearchUrl || !config.geminiConfigured) throw new Error('Research configuration is incomplete');
  const assignments = await researchAssignments(db);
  if (!assignments.length) throw new Error('Research registry has no active route');
  // The primary route supplies collection tools. Fallback routes only replace
  // analysis, so they cannot repair a missing primary collection tool.
  for (const assignment of assignments) {
    if (assignment.provider_code !== 'gemini' || assignment.credential_secret_ref !== 'env:GEMINI_API_KEY' ||
      !/^[a-z0-9._-]{1,200}$/i.test(assignment.provider_model_id.replace(/^models\//,''))) throw new Error('Research registry route is unsupported');
  }
  const tools = await permittedTools(db,assignments[0]!.agent_id);
  for (const code of ['ultrasearch_search','public_url_fetch','pdf_extract']) {
    const tool = tools.get(code);
    if (code === 'ultrasearch_search' && tool.credential_secret_ref &&
      (tool.credential_secret_ref !== 'env:ULTRASEARCH_API_KEY' || !env.ULTRASEARCH_API_KEY)) throw new Error('Search credentials are incomplete');
  }
}
