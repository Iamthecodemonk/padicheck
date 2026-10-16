import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import { ApiError } from '../../errors.js';
import { hashPassword, verifyPassword } from './password.js';
import { authSession, type AuthUser } from './session.js';
import { emailAuthRoutes } from './email-routes.js';
import { googleAuthRoutes } from './google-routes.js';
import type { AuthDependencies } from './identity-types.js';
import type { TokenRevocations } from './revocations.js';
import { tokenDigest } from '../authorization/index.js';

type Credentials = { email: string; password: string };
type User = AuthUser;
const credentialsProperties = {
  email: { type: 'string', format: 'email', maxLength: 254 },
  password: { type: 'string', minLength: 12, maxLength: 128 },
};

export async function authRoutes(app: FastifyInstance, db: Database, access: Authorization, revocations: TokenRevocations, identity:AuthDependencies, secret:string) {
  app.addHook('onSend',async(request,reply,payload)=>{if(request.url.startsWith('/v1/auth'))reply.header('Cache-Control','no-store');return payload;});
  await emailAuthRoutes(app,db,access,identity,secret);
  await googleAuthRoutes(app,db,access,identity,secret);
  // Used for missing accounts so login also performs expensive password work.
  const dummyHash = await hashPassword('unused dummy login credential');
  const authLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };
  const tokenFor = (user: User) => authSession(app,user);

  app.post<{ Body: Credentials }>('/v1/auth/login', {
    config: authLimit,
    schema: { body: { type: 'object', additionalProperties: false,
      required: ['email', 'password'], properties: credentialsProperties } },
  }, async (request, reply) => {
    const result = await db.query<User & { password_hash: string; auth_account_id: string }>(`
      SELECT u.users_id, u.display_name, u.email, u.account_status, u.email_verified_at, a.password_hash, a.auth_account_id
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
