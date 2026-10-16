import { createHash, randomBytes } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { Database, SqlExecutor } from '../../database/index.js';
import { ApiError } from '../../errors.js';
import { publicUrl } from '../../adapters/public-web.js';

export const shareFields = 'share_link_id, investigation_id, created_at, expires_at, revoked_at';
export const digest = (secret: string) => createHash('sha256').update(secret).digest('hex');
export const unavailable = () => new ApiError(404, 'share_unavailable', 'Shared investigation is unavailable');

export async function auditShare(client: SqlExecutor, request: FastifyRequest, action: string, id: string, state: unknown) {
  // Neither the raw bearer capability nor its hash belongs in audit snapshots.
  await client.query(`INSERT INTO admin_audit_logs (actor_user_id,action,target_type,target_id,after_state,request_id)
    VALUES ($1,$2,'investigation_share_link',$3,$4::jsonb,$5)`,
  [request.principal!.users_id, action, id, JSON.stringify(state), request.id]);
}

export async function lockOwned(client: SqlExecutor, investigationId: string, owner: string) {
  const row = (await client.query('SELECT investigation_id,status FROM investigations WHERE investigation_id = $1 AND user_id = $2 FOR UPDATE',
    [investigationId, owner])).rows[0];
  if (!row) throw new ApiError(404, 'investigation_not_found', 'Investigation was not found');
  return row;
}

export async function issueShare(db: Database, request: FastifyRequest, investigationId: string, ttl: number) {
  const token = randomBytes(32).toString('base64url');
  const share = await db.transaction(async client => {
    const investigation = await lockOwned(client, investigationId, request.principal!.users_id);
    if (investigation.status !== 'completed') throw new ApiError(409, 'investigation_not_completed', 'Only completed investigations can be shared');
    // All creation paths lock the investigation first, serializing the active-link cap.
    const count = (await client.query(`SELECT count(*) AS total FROM investigation_share_links WHERE investigation_id = $1
      AND revoked_at IS NULL AND expires_at > clock_timestamp()`, [investigationId])).rows[0]!.total;
    if (Number(count) >= 10) throw new ApiError(409, 'share_limit_reached', 'Revoke an active share before creating another');
    const row = (await client.query(`INSERT INTO investigation_share_links (investigation_id,created_by_user_id,token_hash,expires_at)
      VALUES ($1,$2,$3,now() + $4 * interval '1 second') RETURNING ${shareFields}`,
    [investigationId, request.principal!.users_id, digest(token), ttl])).rows[0]!;
    await auditShare(client, request, 'investigations.share.create', row.share_link_id, { ...row, acknowledged_sensitive_content: true });
    return row;
  });
  return { share, token };
}

// Existing links (including externally inserted nonexpiring links) fail closed
// unless they meet the application's expiration and ownership rules.
const validLink = `link.revoked_at IS NULL AND link.expires_at > clock_timestamp()
  AND link.expires_at <= link.created_at + interval '30 days'
  AND i.status = 'completed' AND i.user_id = link.created_by_user_id AND u.account_status = 'active'
  AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
    JOIN role_permissions rp ON rp.role_id = r.role_id JOIN permissions p ON p.permission_id = rp.permission_id
    WHERE ur.users_id = u.users_id AND (p.permission_key = 'investigations.create' OR (r.role_key = 'superadmin' AND p.permission_key = '*')))
  AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
    JOIN role_permissions rp ON rp.role_id = r.role_id JOIN permissions p ON p.permission_id = rp.permission_id
    WHERE ur.users_id = u.users_id AND (p.permission_key IN ('investigations.read_own','investigations.read_all')
      OR (r.role_key = 'superadmin' AND p.permission_key = '*')))`;

function shareableUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const url = publicUrl(raw);
    // Query-bearing links may contain credentials or expiring storage signatures.
    if (url.search) return null;
    return url.href;
  } catch { return null; }
}

export async function resolveShare(db: Database, token: string) {
  // Canonical 256-bit base64url only, avoiding alternate encodings of a secret.
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || Buffer.from(token, 'base64url').toString('base64url') !== token) throw unavailable();
  return db.transaction(async client => {
    // Match mutation lock order: investigation first, share second. A single
    // joined FOR SHARE could otherwise deadlock with a concurrent revocation.
    const owned = await client.query(`SELECT i.investigation_id FROM investigations i JOIN users u ON u.users_id = i.user_id
      WHERE EXISTS (SELECT 1 FROM investigation_share_links link WHERE link.token_hash = $1
        AND link.investigation_id = i.investigation_id AND link.created_by_user_id = u.users_id) FOR SHARE OF i,u`, [digest(token)]);
    if (!owned.rowCount) throw unavailable();
    const row = (await client.query(`SELECT link.share_link_id, i.investigation_id, i.investigation_type, i.title,
      i.result_summary, i.completed_at FROM investigation_share_links link
      JOIN investigations i ON i.investigation_id = link.investigation_id JOIN users u ON u.users_id = link.created_by_user_id
      WHERE link.token_hash = $1 AND ${validLink} FOR SHARE OF link, i, u`, [digest(token)])).rows[0];
    if (!row) throw unavailable();
    const findings = await client.query(`SELECT finding_id,finding_type,category,title,explanation,confidence,verification_status,display_order
      FROM findings WHERE investigation_id = $1 ORDER BY display_order,finding_id LIMIT 101`, [row.investigation_id]);
    const links = await client.query(`SELECT fs.finding_id, fs.source_id, fs.support_type,
      CASE WHEN s.visibility = 'public' AND s.media_id IS NULL AND s.source_type IN ('web_page','user_provided_link')
        AND EXISTS (SELECT 1 FROM investigation_sources isl WHERE isl.investigation_id = $1 AND isl.source_id = s.source_id)
        THEN jsonb_build_object('source_id',s.source_id,'url',s.url,'title',s.title,'publisher',s.publisher,
          'fetched_at',s.fetched_at,'support_type',fs.support_type,'evidence_note',fs.evidence_note) ELSE NULL END AS source
      FROM finding_sources fs JOIN sources s ON s.source_id = fs.source_id WHERE fs.finding_id = ANY($2::uuid[])
      ORDER BY fs.finding_id,fs.source_id`, [row.investigation_id, findings.rows.slice(0,100).map(f => f.finding_id)]);
    const publicFindings = findings.rows.slice(0,100).map(finding => {
      const evidence = links.rows.filter(link => link.finding_id === finding.finding_id);
      const sources = evidence.flatMap(link => {
        const source = link.source as Record<string, unknown> | null;
        const url = shareableUrl(source?.url);
        return source && url ? [{ ...source, url }] : [];
      });
      return { ...finding, sources, hidden_evidence_count: evidence.length - sources.length };
    });
    // Recheck expiration at the end of rendering. Revocation/status changes must
    // wait for the shared locks, so no later resolution can pass after revoke commits.
    const stillValid = await client.query(`SELECT 1 FROM investigation_share_links link
      JOIN investigations i ON i.investigation_id = link.investigation_id JOIN users u ON u.users_id = link.created_by_user_id
      WHERE link.share_link_id = $1 AND ${validLink}`, [row.share_link_id]);
    if (!stillValid.rowCount) throw unavailable();
    return { investigation: { investigation_type: row.investigation_type, title: row.title, result_summary: row.result_summary,
      completed_at: row.completed_at }, findings: publicFindings, findings_truncated: findings.rows.length > 100,
    limitations: ['Shared summaries and findings may include sensitive information supplied by the owner. AI interpretation can be incomplete or wrong and does not prove a claim true.',
      'Private evidence, uploads, prompts, account details and internal execution records are excluded. Hidden evidence cannot be assessed through this share.'] };
  });
}
