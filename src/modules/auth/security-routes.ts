import { randomUUID } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import type { AppConfig } from '../../config.js';
import type { AuthUser } from './session.js';
import { ApiError } from '../../errors.js';
import { consumeSecondFactor, digest, encryptFactor, registeredSession, replaceRecoveryCodes, lockSecurityAccount } from './security.js';
import { body, params } from '../trust/shared.js';

const proofBody = body({ code: { type: 'string', pattern: '^(?:[0-9]{6}|[a-f0-9]{24})$' } }, ['code']);
export async function securityRoutes(app: FastifyInstance, db: Database, access: Authorization, config: AppConfig) {
  function available() { if (!config.platformEnabled) throw new ApiError(503, 'platform_unavailable', 'Platform extension is not enabled'); }
  const authenticated = async (request: FastifyRequest) => { available(); await access.authenticate(request); };
  const recent = async (request: FastifyRequest) => {
    await authenticated(request);
    const found = await db.query(`SELECT 1 FROM auth_sessions WHERE users_id=$1 AND jti_hash=$2 AND revoked_at IS NULL
      AND authenticated_at>now()-interval '5 minutes' AND expires_at>now()`, [request.principal!.users_id, digest(request.user.jti ?? '')]);
    if (!found.rowCount) throw new ApiError(403, 'recent_login_required', 'Sign in again before changing account security');
  };
  app.get('/v1/auth/sessions', { onRequest: authenticated }, async request => ({ sessions: (await db.query(`SELECT session_id,authenticated_at,expires_at,
    jti_hash=$2 AS is_current FROM auth_sessions WHERE users_id=$1 AND revoked_at IS NULL AND expires_at>now()
    ORDER BY authenticated_at DESC,session_id LIMIT 100`, [request.principal!.users_id, digest(request.user.jti ?? '')])).rows }));
  app.delete<{ Params: { id: string } }>('/v1/auth/sessions/:id', { onRequest: authenticated, schema: { params: params('id') } }, async (request, reply) => {
    const result = await db.query('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE users_id=$1 AND session_id=$2 RETURNING session_id', [request.principal!.users_id, request.params.id]);
    if (!result.rowCount) throw new ApiError(404, 'session_not_found', 'Session was not found');
    return reply.code(204).send();
  });
  app.post('/v1/auth/logout-all', { onRequest: authenticated }, async (request, reply) => {
    await db.transaction(async client => {
      await lockSecurityAccount(client,request,false);
      await client.query('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE users_id=$1', [request.principal!.users_id]);
      await client.query('UPDATE auth_login_challenges SET consumed_at=COALESCE(consumed_at,now()) WHERE users_id=$1', [request.principal!.users_id]);
    });
    return reply.code(204).send();
  });
  app.get('/v1/auth/mfa', { onRequest: authenticated }, async request => {
    const row = (await db.query('SELECT enabled_at FROM auth_totp_factors WHERE users_id=$1', [request.principal!.users_id])).rows[0];
    return { enabled: Boolean(row?.enabled_at), recovery_codes_remaining: Number((await db.query('SELECT count(*) AS count FROM auth_recovery_codes WHERE users_id=$1', [request.principal!.users_id])).rows[0]!.count) };
  });
  app.post('/v1/auth/mfa/setup', { onRequest: recent, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async request => {
    if (!request.principal!.email_verified_at) throw new ApiError(403, 'verified_email_required', 'Verify your email before enabling two-factor authentication');
    const secret = new Secret({ size: 20 });
    await db.transaction(async client => {
      await lockSecurityAccount(client,request);
      const existing = (await client.query('SELECT enabled_at,locked_until FROM auth_totp_factors WHERE users_id=$1 FOR UPDATE', [request.principal!.users_id])).rows[0];
      if (existing?.enabled_at) throw new ApiError(409, 'mfa_already_enabled', 'Two-factor authentication is already enabled');
      if (existing?.locked_until && new Date(existing.locked_until).getTime() > Date.now()) throw new ApiError(429, 'mfa_rate_limited', 'Wait before trying again');
      const ciphertext = encryptFactor(secret.base32, config.accountEncryptionKey!, request.principal!.users_id);
      await client.query(`INSERT INTO auth_totp_factors(users_id,pending_ciphertext,pending_expires_at) VALUES ($1,$2,now()+interval '10 minutes')
        ON CONFLICT(users_id) DO UPDATE SET pending_ciphertext=EXCLUDED.pending_ciphertext,pending_expires_at=EXCLUDED.pending_expires_at,last_counter=-1`, [request.principal!.users_id, ciphertext]);
    });
    return { secret: secret.base32, otpauth_uri: new TOTP({ issuer: 'PadiCheck', label: request.principal!.email, secret, digits: 6, period: 30, algorithm: 'SHA1' }).toString(), expires_in: 600 };
  });
  for (const action of ['confirm', 'disable', 'recovery-codes'] as const) {
    app.post<{ Body: { code: string } }>(`/v1/auth/mfa/${action}`, {
      onRequest: recent, config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, schema: { body: proofBody },
    }, async request => {
      const result = await db.transaction(async client => {
        const id = request.principal!.users_id;
        await lockSecurityAccount(client,request);
        const factor = (await client.query('SELECT enabled_at FROM auth_totp_factors WHERE users_id=$1', [id])).rows[0];
        if (action === 'confirm' && factor?.enabled_at || action !== 'confirm' && !factor?.enabled_at) return null;
        if (!await consumeSecondFactor(client, id, request.body.code, config.accountEncryptionKey!, action === 'confirm')) return null;
        if (action === 'confirm') await client.query('UPDATE auth_totp_factors SET secret_ciphertext=pending_ciphertext,enabled_at=now(),pending_ciphertext=NULL,pending_expires_at=NULL WHERE users_id=$1', [id]);
        if (action === 'disable') {
          await client.query('DELETE FROM auth_recovery_codes WHERE users_id=$1', [id]);
          await client.query('DELETE FROM auth_totp_factors WHERE users_id=$1', [id]);
        }
        const recovery_codes = action === 'disable' ? undefined : await replaceRecoveryCodes(client, id);
        await client.query('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE users_id=$1', [id]);
        await client.query('UPDATE auth_login_challenges SET consumed_at=COALESCE(consumed_at,now()) WHERE users_id=$1', [id]);
        await client.query(`INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,request_id)
          VALUES ($1,$2,'user',$1,$3)`, [id, `auth.mfa.${action}`, request.id]);
        return { enabled: action !== 'disable', ...(recovery_codes ? { recovery_codes } : {}), sign_in_required: true };
      });
      if (!result) throw new ApiError(400, 'invalid_mfa_code', 'Code is invalid, used, expired or temporarily locked');
      return result;
    });
  }
  app.post<{ Body: { challenge_token: string; code: string } }>('/v1/auth/mfa/verify', {
    onRequest: async () => { available(); }, bodyLimit: 8192, config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: { body: body({ challenge_token: { type: 'string', minLength: 1, maxLength: 4096 }, code: { type: 'string', pattern: '^(?:[0-9]{6}|[a-f0-9]{24})$' } }, ['challenge_token','code']) },
  }, async request => {
    let claims: { sub: string; jti: string; stage?: string };
    try { claims = app.jwt.verify(request.body.challenge_token); if (claims.stage !== 'mfa' || !/^[a-f0-9-]{36}$/i.test(claims.jti ?? '') || !/^[a-f0-9-]{36}$/i.test(claims.sub ?? '')) throw new Error(); }
    catch { throw new ApiError(401, 'invalid_mfa_challenge', 'Sign in again to obtain a valid challenge'); }
    const result = await db.transaction(async client => {
      const user = (await client.query<AuthUser>("SELECT users_id,display_name,email,email_verified_at,account_status FROM users WHERE users_id=$1 AND account_status='active' FOR UPDATE", [claims.sub])).rows[0];
      if (!user) return null;
      const challenge = await client.query(`UPDATE auth_login_challenges SET attempts=attempts+1 WHERE challenge_id=$1 AND users_id=$2
        AND consumed_at IS NULL AND expires_at>now() AND attempts<5 RETURNING challenge_id`, [claims.jti, claims.sub]);
      if (!challenge.rowCount || !await consumeSecondFactor(client, claims.sub, request.body.code, config.accountEncryptionKey!)) return null;
      await client.query('UPDATE auth_login_challenges SET consumed_at=now() WHERE challenge_id=$1', [claims.jti]);
      return registeredSession(app, client, user);
    });
    if (!result) throw new ApiError(401, 'invalid_mfa_code', 'Code or challenge is invalid, expired, used or temporarily locked');
    return result;
  });
}
