import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import type { AuthDependencies } from './identity-types.js';
import { authSession, type AuthUser } from './session.js';
import { authKey } from './email-routes.js';
import { ApiError } from '../../errors.js';

export async function googleAuthRoutes(app:FastifyInstance,db:Database,access:Authorization,auth:AuthDependencies,secret:string){
  function available(){if(!auth.challenges||!auth.google)throw new ApiError(503,'google_auth_unavailable','Google sign-in is not configured');return {store:auth.challenges,google:auth.google};}
  app.post<{Body:{action:'login'|'link'}}>('/v1/auth/google/challenge',{
    config:{rateLimit:{max:20,timeWindow:'1 minute'}},schema:{body:{type:'object',additionalProperties:false,properties:{action:{type:'string',enum:['login','link'],default:'login'}}}},
  },async request=>{
    const {store}=available();if(request.body.action==='link')await access.authenticate(request);
    const nonce=randomBytes(32).toString('base64url');
    await store.putNonce(authKey(secret,'google-nonce',nonce),request.body.action==='link'?`link:${request.principal!.users_id}`:'login');
    return {nonce,expires_in:300};
  });
  for(const action of ['login','link'] as const){
    app.post<{Body:{id_token:string}}>(action==='login'?'/v1/auth/google':'/v1/auth/google/link',{
      ...(action==='link'?{onRequest:access.authenticate}:{}),bodyLimit:16384,config:{rateLimit:{max:20,timeWindow:'1 minute'}},
      schema:{body:{type:'object',additionalProperties:false,required:['id_token'],properties:{id_token:{type:'string',minLength:1,maxLength:12000}}}},
    },async(request,reply)=>{
      const {store,google}=available();const identity=await google.verify(request.body.id_token);
      if(!await store.consumeNonce(authKey(secret,'google-nonce',identity.nonce),action==='link'?`link:${request.principal!.users_id}`:'login')){
        throw new ApiError(401,'invalid_google_challenge','Google sign-in challenge is invalid, expired or already used');
      }
      try{
        const user=await db.transaction(async client=>{
          // A stable subject is the identity; never rematch an existing identity by email.
          const existing=(await client.query<{users_id:string}>("SELECT users_id FROM user_auth_accounts WHERE provider='google' AND provider_subject=$1",[identity.sub])).rows[0];
          if(action==='link'){
            const local=(await client.query<AuthUser>(`SELECT users_id,display_name,email,account_status,email_verified_at FROM users WHERE users_id=$1 AND account_status='active' FOR UPDATE`,[request.principal!.users_id])).rows[0];
            if(!local)throw new ApiError(401,'unauthorized','Account is unavailable');
            if(!local.email_verified_at||local.email.toLowerCase()!==identity.email.toLowerCase())throw new ApiError(409,'verified_email_required','Verify your account email before linking a matching Google identity');
            if(existing&&existing.users_id!==local.users_id)throw new ApiError(409,'google_identity_linked','This Google identity belongs to another account');
            if(!existing){
              await client.query(`INSERT INTO user_auth_accounts (users_id,provider,provider_subject,provider_email) VALUES ($1,'google',$2,$3)`,[local.users_id,identity.sub,identity.email]);
              await client.query(`INSERT INTO admin_audit_logs (actor_user_id,action,target_type,target_id,after_state,request_id)
                VALUES ($1,'auth.google.link','user',$1,'{"provider":"google"}',$2)`,[local.users_id,request.id]);
            }
            return local;
          }
          let user:AuthUser;
          if(existing){
            const row=(await client.query<AuthUser>("SELECT users_id,display_name,email,account_status,email_verified_at FROM users WHERE users_id=$1 AND account_status='active' FOR UPDATE",[existing.users_id])).rows[0];
            if(!row)throw new ApiError(401,'unauthorized','Account is unavailable');user=row;
          }else{
            if((await client.query('SELECT 1 FROM users WHERE lower(email)=lower($1)',[identity.email])).rowCount)throw new ApiError(409,'account_link_required','Sign in to your existing account and link Google');
            if(!identity.authoritative_email)throw new ApiError(409,'email_verification_required','Sign up with email verification first, then link Google');
            user=(await client.query<AuthUser>(`INSERT INTO users (display_name,email,email_verified_at) VALUES ($1,$2,now())
              RETURNING users_id,display_name,email,account_status,email_verified_at`,[identity.name,identity.email])).rows[0]!;
            await client.query(`INSERT INTO user_auth_accounts (users_id,provider,provider_subject,provider_email) VALUES ($1,'google',$2,$3)`,[user.users_id,identity.sub,identity.email]);
            if(auth.onRegistered)await auth.onRegistered(client,user.users_id);
          }
          await client.query('UPDATE users SET last_login_at=now() WHERE users_id=$1',[user.users_id]);
          await client.query("UPDATE user_auth_accounts SET last_used_at=now() WHERE provider='google' AND provider_subject=$1",[identity.sub]);
          return user;
        });
        return action==='link'?{linked:true}:authSession(app,user,auth.platformEnabled?db:undefined);
      }catch(error){if((error as {code?:string}).code==='23505')throw new ApiError(409,'identity_conflict','Account changed; sign in again to link Google');throw error;}
    });
  }
}
