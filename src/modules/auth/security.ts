import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Database, SqlExecutor } from '../../database/index.js';
import type { AuthUser } from './session.js';
import { ApiError } from '../../errors.js';

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function lockSecurityAccount(client: SqlExecutor, request: FastifyRequest, recent = true) {
  const active = await client.query("SELECT users_id FROM users WHERE users_id=$1 AND account_status='active' FOR UPDATE", [request.principal!.users_id]);
  const session = await client.query(`SELECT 1 FROM auth_sessions WHERE users_id=$1 AND jti_hash=$2 AND revoked_at IS NULL
    AND expires_at>now() AND (NOT $3::boolean OR authenticated_at>now()-interval '5 minutes')`,
  [request.principal!.users_id, digest(request.user.jti ?? ''), recent]);
  if (!active.rowCount || !session.rowCount) throw new ApiError(401,'unauthorized','Sign in again before changing account security');
}
export const authenticator = (secret: string) => new TOTP({ issuer: 'PadiCheck', label: 'PadiCheck', algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) });
export function encryptFactor(secret: string, key: string, userId: string) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  cipher.setAAD(Buffer.from(`padicheck:totp:${userId}`));
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
function decryptFactor(value: string, key: string, userId: string) {
  const bytes = Buffer.from(value, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from(`padicheck:totp:${userId}`)); cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8');
}

export async function registeredSession(app: FastifyInstance, client: SqlExecutor, user: AuthUser) {
  const jti = randomUUID();
  // User row must be locked by caller, serializing issuance with logout-all/MFA.
  const access_token = app.jwt.sign({ sub: user.users_id, jti, stage: 'access' });
  const payload = app.jwt.decode<{ exp: number }>(access_token)!;
  await client.query('INSERT INTO auth_sessions(users_id,jti_hash,expires_at) VALUES ($1,$2,to_timestamp($3))', [user.users_id, digest(jti), payload.exp]);
  return { user: { users_id: user.users_id, display_name: user.display_name, email: user.email, email_verified: Boolean(user.email_verified_at) },
    access_token, token_type: 'Bearer' as const, expires_in: 900 };
}

export async function platformLogin(app: FastifyInstance, db: Database, user: AuthUser) {
  return db.transaction(async client => {
    const active = (await client.query<AuthUser>("SELECT users_id,display_name,email,email_verified_at,account_status FROM users WHERE users_id=$1 AND account_status='active' FOR UPDATE", [user.users_id])).rows[0];
    if (!active) throw new ApiError(401, 'unauthorized', 'Account is unavailable');
    const factor = await client.query('SELECT 1 FROM auth_totp_factors WHERE users_id=$1 AND enabled_at IS NOT NULL', [user.users_id]);
    if (!factor.rowCount) return registeredSession(app, client, active);
    // Bound outstanding login challenges per account, including across replicas.
    await client.query('DELETE FROM auth_login_challenges WHERE users_id=$1 AND (expires_at<=now() OR consumed_at IS NOT NULL)', [user.users_id]);
    const outstanding = await client.query('SELECT count(*)::integer AS count FROM auth_login_challenges WHERE users_id=$1', [user.users_id]);
    if (outstanding.rows[0]!.count >= 5) throw new ApiError(429, 'mfa_rate_limited', 'Wait before starting another sign-in');
    const id = randomUUID();
    await client.query("INSERT INTO auth_login_challenges(challenge_id,users_id,expires_at) VALUES ($1,$2,now()+interval '5 minutes')", [id, user.users_id]);
    return { mfa_required: true as const, challenge_token: app.jwt.sign({ sub: user.users_id, jti: id, stage: 'mfa' }, { expiresIn: '5m' }), expires_in: 300 };
  });
}

// Return false, rather than throwing in the transaction, so failed-attempt writes commit.
export async function consumeSecondFactor(client: SqlExecutor, userId: string, code: string, key: string, pending = false) {
  const factor = (await client.query<{ secret_ciphertext: string | null; pending_ciphertext: string | null; pending_expires_at: Date | null;
    last_counter: string; failed_attempts: number; locked_until: Date | null }>('SELECT * FROM auth_totp_factors WHERE users_id=$1 FOR UPDATE', [userId])).rows[0];
  if (!factor || factor.locked_until && new Date(factor.locked_until).getTime() > Date.now()) return false;
  const ciphertext = pending ? factor.pending_ciphertext : factor.secret_ciphertext;
  if (!ciphertext || pending && (!factor.pending_expires_at || new Date(factor.pending_expires_at).getTime() <= Date.now())) return false;
  let valid = false;
  if (/^\d{6}$/.test(code)) {
    const totp = authenticator(decryptFactor(ciphertext, key, userId));
    const now = Date.now(); const delta = totp.validate({ token: code, window: 1, timestamp: now });
    const counter = Math.floor(now / 30000) + (delta ?? 0);
    if (delta !== null && counter > Number(factor.last_counter)) {
      await client.query('UPDATE auth_totp_factors SET last_counter=$2 WHERE users_id=$1', [userId, counter]); valid = true;
    }
  } else if (!pending && /^[a-f0-9]{24}$/.test(code)) {
    valid = Boolean((await client.query('DELETE FROM auth_recovery_codes WHERE users_id=$1 AND code_hash=$2 RETURNING code_hash', [userId, digest(code)])).rowCount);
  }
  await client.query(`UPDATE auth_totp_factors SET failed_attempts=CASE WHEN $2 THEN 0 ELSE failed_attempts+1 END,
    locked_until=CASE WHEN $2 THEN NULL WHEN failed_attempts>=4 THEN now()+interval '5 minutes' ELSE locked_until END WHERE users_id=$1`, [userId, valid]);
  return valid;
}

export async function replaceRecoveryCodes(client: SqlExecutor, userId: string) {
  const codes = Array.from({ length: 10 }, () => randomBytes(12).toString('hex'));
  await client.query('DELETE FROM auth_recovery_codes WHERE users_id=$1', [userId]);
  for (const code of codes) await client.query('INSERT INTO auth_recovery_codes(users_id,code_hash) VALUES ($1,$2)', [userId, digest(code)]);
  return codes;
}
