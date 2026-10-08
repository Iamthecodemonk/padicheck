import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import { ApiError } from '../../errors.js';

const userParams = { type: 'object', additionalProperties: false, required: ['users_id'],
  properties: { users_id: { type: 'string', format: 'uuid' } } };

export async function adminRoutes(app: FastifyInstance, db: Database, access: Authorization) {
  app.get('/v1/admin/roles', { preHandler: access.requirePermission('roles.read') }, async () => {
    const roles = await db.query(`SELECT r.role_id, r.role_key, r.display_name, r.description,
      COALESCE(array_agg(p.permission_key ORDER BY p.permission_key) FILTER (WHERE p.permission_key IS NOT NULL), '{}') AS permissions
      FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
      LEFT JOIN permissions p ON p.permission_id = rp.permission_id
      GROUP BY r.role_id ORDER BY r.role_key`);
    return { roles: roles.rows };
  });

  app.post<{ Params: { users_id: string }; Body: { role_key: string } }>('/v1/admin/users/:users_id/roles', {
    preHandler: access.requirePermission('roles.manage'),
    schema: { params: userParams, body: { type: 'object', additionalProperties: false,
      required: ['role_key'], properties: { role_key: { type: 'string', minLength: 1, maxLength: 80 } } } },
  }, async request => {
    // All role grants are superadmin operations, even if an ordinary role has
    // accidentally been granted roles.manage in the database.
    if (!request.principal!.roles.includes('superadmin')) {
      throw new ApiError(403, 'superadmin_required', 'Role assignment requires superadmin access');
    }
    return db.transaction(async client => {
      const user = await client.query('SELECT users_id FROM users WHERE users_id = $1 FOR UPDATE', [request.params.users_id]);
      const role = await client.query('SELECT role_id FROM roles WHERE role_key = $1', [request.body.role_key]);
      if (!user.rowCount || !role.rowCount) throw new ApiError(404, 'not_found', 'User or role does not exist');
      const before = await client.query(`SELECT r.role_key FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
        WHERE ur.users_id = $1 ORDER BY r.role_key`, [request.params.users_id]);
      const grant = await client.query(`INSERT INTO user_roles (users_id, role_id, granted_by_user_id)
        VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING role_id`,
      [request.params.users_id, role.rows[0]!.role_id, request.principal!.users_id]);
      if (!grant.rowCount) return { granted: false };
      const after = [...before.rows.map(r => r.role_key), request.body.role_key].sort();
      await client.query(`INSERT INTO admin_audit_logs (actor_user_id, action, target_type, target_id, before_state, after_state, request_id)
        VALUES ($1, 'roles.grant', 'user', $2, $3::jsonb, $4::jsonb, $5)`,
      [request.principal!.users_id, request.params.users_id, JSON.stringify({ roles: before.rows.map(r => r.role_key) }), JSON.stringify({ roles: after }), request.id]);
      return { granted: true };
    });
  });
}
