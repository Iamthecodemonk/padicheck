import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import { ApiError } from '../../errors.js';
import { hashPassword, verifyPassword } from './password.js';
import { randomUUID } from 'node:crypto';
import type { TokenRevocations } from './revocations.js';
import { tokenDigest } from '../authorization/index.js';

type Credentials = { email: string; password: string };
type Registration = Credentials & { display_name: string };
type User = { users_id: string; display_name: string; email: string; account_status: string };
const credentialsProperties = {
  email: { type: 'string', format: 'email', maxLength: 254 },
  password: { type: 'string', minLength: 12, maxLength: 128 },
};

export async function authRoutes(app: FastifyInstance, db: Database, access: Authorization, revocations: TokenRevocations) {
  // Used for missing accounts so login also performs expensive password work.
  const dummyHash = await hashPassword('unused dummy login credential');
  const authLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };
  const tokenFor = (user: User) => ({
    user: { users_id: user.users_id, display_name: user.display_name, email: user.email },
    access_token: app.jwt.sign({ sub: user.users_id, jti: randomUUID() }),
    token_type: 'Bearer', expires_in: 900,
  });

  app.post<{ Body: Registration }>('/v1/auth/register', {
    config: authLimit,
    schema: { body: { type: 'object', additionalProperties: false,
      required: ['email', 'password', 'display_name'], properties: {
        ...credentialsProperties, display_name: { type: 'string', minLength: 1, maxLength: 120 },
      } } },
  }, async (request, reply) => {
    const { email, password } = request.body;
    const displayName = request.body.display_name.trim();
    if (!displayName) throw new ApiError(400, 'invalid_display_name', 'Display name must not be blank');
    const passwordHash = await hashPassword(password);
    try {
      const user = await db.transaction(async client => {
        const result = await client.query<User>(`
          INSERT INTO users (display_name, email) VALUES ($1, $2)
          RETURNING users_id, display_name, email, account_status`, [displayName, email.trim()]);
        const created = result.rows[0]!;
        await client.query(`INSERT INTO user_auth_accounts (users_id, provider, password_hash, provider_email)
          VALUES ($1, 'password', $2, $3)`, [created.users_id, passwordHash, created.email]);
        // The schema's AFTER INSERT trigger grants the default user role.
        return created;
      });
      reply.header('Cache-Control', 'no-store');
      return reply.code(201).send(tokenFor(user));
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApiError(409, 'account_exists', 'An account with this email already exists');
      }
      throw error;
    }
  });

  app.post<{ Body: Credentials }>('/v1/auth/login', {
    config: authLimit,
    schema: { body: { type: 'object', additionalProperties: false,
      required: ['email', 'password'], properties: credentialsProperties } },
  }, async (request, reply) => {
    const result = await db.query<User & { password_hash: string; auth_account_id: string }>(`
      SELECT u.users_id, u.display_name, u.email, u.account_status, a.password_hash, a.auth_account_id
      FROM users u JOIN user_auth_accounts a ON a.users_id = u.users_id AND a.provider = 'password'
      WHERE lower(u.email) = lower($1)`, [request.body.email.trim()]);
    const user = result.rows[0];
    const valid = await verifyPassword(request.body.password, user?.password_hash ?? dummyHash);
    if (!user || !valid || user.account_status !== 'active') {
      throw new ApiError(401, 'invalid_credentials', 'Invalid email or password');
    }
    // Lock and recheck account status before recording login or issuing a token.
    await db.transaction(async client => {
      const active = await client.query("SELECT users_id FROM users WHERE users_id = $1 AND account_status = 'active' FOR UPDATE", [user.users_id]);
      if (!active.rowCount) throw new ApiError(401, 'invalid_credentials', 'Invalid email or password');
      await client.query('UPDATE users SET last_login_at = now() WHERE users_id = $1', [user.users_id]);
      await client.query('UPDATE user_auth_accounts SET last_used_at = now() WHERE auth_account_id = $1', [user.auth_account_id]);
    });
    reply.header('Cache-Control', 'no-store');
    return tokenFor(user);
  });

  app.get('/v1/auth/me', { preHandler: access.authenticate }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { user: request.principal };
  });

  app.post('/v1/auth/logout', { preHandler: access.authenticate }, async (request, reply) => {
    await revocations.revoke(tokenDigest(request), request.user.exp);
    reply.header('Cache-Control', 'no-store');
    return reply.code(204).send();
  });
}
