import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

export type AuthUser = {users_id:string;display_name:string;email:string;account_status:string;email_verified_at?:Date|null};
export function authSession(app:FastifyInstance,user:AuthUser){
  return {user:{users_id:user.users_id,display_name:user.display_name,email:user.email,email_verified:Boolean(user.email_verified_at)},
    access_token:app.jwt.sign({sub:user.users_id,jti:randomUUID()}),token_type:'Bearer',expires_in:900};
}
