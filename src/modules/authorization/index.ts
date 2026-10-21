import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Database } from '../../database/index.js';
import { ApiError } from '../../errors.js';
import { createHash } from 'node:crypto';
import type { TokenRevocations } from '../auth/revocations.js';
import { apiKeyPrincipal } from '../platform/api-keys.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; jti?: string; stage?: 'access' | 'mfa' };
    user: { sub: string; jti?: string; exp: number; stage?: 'access' | 'mfa' };
  }
}

export type Principal = {
  users_id: string;
  display_name: string;
  email: string;
  email_verified_at?: Date | null;
  roles: string[];
  permissions: string[];
};

declare module 'fastify' {
  interface FastifyRequest { principal: Principal | null }
}

export function authorization(app: FastifyInstance, db: Database, revocations: TokenRevocations, platformEnabled = false) {
  app.decorateRequest('principal', null);

  async function authenticate(request: FastifyRequest) {
    if(platformEnabled&&request.headers['x-api-key']){
      if(request.headers.authorization)throw new ApiError(400,'ambiguous_credentials','Use either Bearer authentication or X-API-Key');
      request.principal=await apiKeyPrincipal(db,request);return;
    }
    try {
      await request.jwtVerify();
    } catch {
      throw new ApiError(401, 'unauthorized', 'A valid access token is required');
    }
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(request.user.sub ?? '') ||
        !Number.isSafeInteger(request.user.exp)) {
      throw new ApiError(401, 'unauthorized', 'Invalid access token subject');
    }
    if (await revocations.has(tokenDigest(request))) throw new ApiError(401, 'unauthorized', 'Access token has been revoked');
    if (request.user.stage === 'mfa') throw new ApiError(401, 'mfa_required', 'Complete two-factor authentication');
    if (platformEnabled) {
      const session = await db.query(`SELECT 1 FROM auth_sessions WHERE users_id=$1 AND jti_hash=$2 AND revoked_at IS NULL AND expires_at>now()`,
        [request.user.sub, createHash('sha256').update(request.user.jti ?? '').digest('hex')]);
      if (!session.rowCount) throw new ApiError(401, 'unauthorized', 'Session is expired or revoked');
    }
    const result = await db.query<Principal>(`
      SELECT u.users_id, u.display_name, u.email, u.email_verified_at,
        COALESCE(array_agg(DISTINCT r.role_key) FILTER (WHERE r.role_key IS NOT NULL), '{}') AS roles,
        COALESCE(array_agg(DISTINCT p.permission_key) FILTER (WHERE p.permission_key IS NOT NULL), '{}') AS permissions
      FROM users u
      LEFT JOIN user_roles ur ON ur.users_id = u.users_id
      LEFT JOIN roles r ON r.role_id = ur.role_id
      LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
      LEFT JOIN permissions p ON p.permission_id = rp.permission_id
      WHERE u.users_id = $1 AND u.account_status = 'active'
      GROUP BY u.users_id`, [request.user.sub]);
    request.principal = result.rows[0] ?? null;
    if (!request.principal) throw new ApiError(401, 'unauthorized', 'Account is unavailable');
  }

  const can = (principal: Principal, permission: string) =>
    principal.permissions.includes(permission) ||
    (principal.roles.includes('superadmin') && principal.permissions.includes('*'));

  function requirePermission(permission: string) {
    return async (request: FastifyRequest) => {
      await authenticate(request);
      if (!can(request.principal!, permission)) {
        throw new ApiError(403, 'forbidden', 'You do not have permission for this operation');
      }
    };
  }

  return { authenticate, requirePermission, can };
}

export type Authorization = ReturnType<typeof authorization>;

export function tokenDigest(request: FastifyRequest): string {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
  return createHash('sha256').update(token).digest('hex');
}
