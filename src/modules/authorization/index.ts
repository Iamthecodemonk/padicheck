import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Database } from '../../database/index.js';
import { ApiError } from '../../errors.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

export type Principal = {
  users_id: string;
  display_name: string;
  email: string;
  roles: string[];
  permissions: string[];
};

declare module 'fastify' {
  interface FastifyRequest { principal: Principal | null }
}

export function authorization(app: FastifyInstance, db: Database) {
  app.decorateRequest('principal', null);

  async function authenticate(request: FastifyRequest) {
    try {
      await request.jwtVerify();
    } catch {
      throw new ApiError(401, 'unauthorized', 'A valid access token is required');
    }
    if (!/^[a-f0-9-]{36}$/i.test(request.user.sub ?? '')) {
      throw new ApiError(401, 'unauthorized', 'Invalid access token subject');
    }
    const result = await db.query<Principal>(`
      SELECT u.users_id, u.display_name, u.email,
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
