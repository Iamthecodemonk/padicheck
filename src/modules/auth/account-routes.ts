import { randomInt, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Database, SqlExecutor } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import type { AuthDependencies, PendingOtp } from './identity-types.js';
import { ApiError } from '../../errors.js';
import { authKey, authEmail } from './email-routes.js';
import { hashPassword, verifyPassword } from './password.js';
import { lockSecurityAccount } from './security.js';
import { body } from '../trust/shared.js';

const password = {type:'string', minLength:12, maxLength:128};
export async function accountRoutes(app:FastifyInstance, db:Database, access:Authorization, auth:AuthDependencies, secret:string) {
  const available=()=>{if(!auth.platformEnabled)throw new ApiError(503,'platform_unavailable','Account security requires the platform extension');};
  const authenticated=async(request:FastifyRequest)=>{available();await access.authenticate(request);};
  const emailKey=(email:string)=>authKey(secret,'password-reset-email',email.trim().toLowerCase());
  const codeKey=(email:string,id:string,code:string)=>authKey(secret,'password-reset-code',`${emailKey(email)}:${id}:${code}`);
  const mailAvailable=()=>{available();if(!auth.challenges||!auth.mailer)throw new ApiError(503,'email_auth_unavailable','Email recovery is not configured');return {store:auth.challenges,mailer:auth.mailer};};
  async function revoke(client:SqlExecutor,id:string){
    await client.query('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE users_id=$1',[id]);
    await client.query('UPDATE auth_login_challenges SET consumed_at=COALESCE(consumed_at,now()) WHERE users_id=$1',[id]);
  }
  app.get('/v1/me/account',{onRequest:authenticated},async request=>{
    const account=(await db.query('SELECT users_id,display_name,email,phone_number,email_verified_at,created_at FROM users WHERE users_id=$1',[request.principal!.users_id])).rows[0];
    const providers=(await db.query('SELECT provider FROM user_auth_accounts WHERE users_id=$1 ORDER BY provider',[request.principal!.users_id])).rows.map(row=>row.provider);
    return {account,providers};
  });
  app.patch<{Body:{display_name?:string;phone_number?:string|null}}>('/v1/me/account',{
    onRequest:authenticated,bodyLimit:4096,schema:{body:body({display_name:{type:'string',minLength:1,maxLength:120},phone_number:{anyOf:[{type:'string',pattern:'^\\+?[0-9 ()-]{7,25}$'},{type:'null'}]}} ,[])},
  },async request=>{
    const input=request.body;
    if(!Object.keys(input).length||input.display_name!==undefined&&!input.display_name.trim())throw new ApiError(400,'invalid_request','Enter at least one valid profile field');
    const result=await db.query(`UPDATE users SET display_name=COALESCE($2,display_name),phone_number=CASE WHEN $3::boolean THEN $4 ELSE phone_number END,updated_at=now()
      WHERE users_id=$1 AND account_status='active' RETURNING users_id,display_name,email,phone_number,email_verified_at,created_at`,
      [request.principal!.users_id,input.display_name?.trim()??null,Object.hasOwn(input,'phone_number'),input.phone_number??null]);
    return {account:result.rows[0]};
  });
  app.post<{Body:{current_password:string;new_password:string}}>('/v1/auth/password/change',{
    onRequest:authenticated,bodyLimit:4096,config:{rateLimit:{max:5,timeWindow:'1 minute'}},schema:{body:body({current_password:password,new_password:password},['current_password','new_password'])},
  },async request=>{
    const hash=await hashPassword(request.body.new_password);
    await db.transaction(async client=>{
      await lockSecurityAccount(client,request);
      const row=(await client.query('SELECT password_hash FROM user_auth_accounts WHERE users_id=$1 AND provider=\'password\' FOR UPDATE',[request.principal!.users_id])).rows[0];
      if(!row||!await verifyPassword(request.body.current_password,String(row.password_hash)))throw new ApiError(401,'invalid_credentials','Current password is incorrect');
      await client.query("UPDATE user_auth_accounts SET password_hash=$2 WHERE users_id=$1 AND provider='password'",[request.principal!.users_id,hash]);
      await revoke(client,request.principal!.users_id);
      await client.query("INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,request_id) VALUES ($1,'auth.password.change','user',$1,$2)",[request.principal!.users_id,request.id]);
    });
    return {changed:true,sign_in_required:true};
  });
  app.post<{Body:{email:string}}>('/v1/auth/password/reset/request',{
    bodyLimit:1024,config:{rateLimit:{max:5,timeWindow:'1 minute'}},schema:{body:body({email:authEmail},['email'])},
  },async(request,reply)=>{
    const {store,mailer}=mailAvailable();const email=request.body.email.trim().toLowerCase();const id=randomUUID();const code=String(randomInt(0,1000000)).padStart(6,'0');
    const row=(await db.query(`SELECT u.users_id,a.password_hash FROM users u JOIN user_auth_accounts a ON a.users_id=u.users_id AND a.provider='password'
      WHERE lower(u.email)=lower($1) AND u.account_status='active'`,[email])).rows[0];
    // The public response is identical for eligible and unknown addresses.
    const pending:PendingOtp={purpose:'password_reset',email,challenge_id:id,code_digest:codeKey(email,id,code),...(row?{users_id:String(row.users_id),password_hash:String(row.password_hash)}:{})};
    if(!await store.putOtp(emailKey(email),pending))throw new ApiError(429,'otp_rate_limited','Wait before requesting another code');
    if(row){try{await mailer.sendCode(email,code,{key:emailKey(email),challenge_id:id,expires_at:Date.now()+600000,purpose:'password_reset'});}catch{await store.discardOtp(emailKey(email),id);throw new ApiError(503,'email_delivery_failed','The recovery email could not be queued');}}
    return reply.code(202).send({challenge_id:id,expires_in:600,message:'If an eligible account exists, a password reset code has been queued.'});
  });
  app.post<{Body:{email:string;challenge_id:string;code:string;new_password:string}}>('/v1/auth/password/reset/confirm',{
    bodyLimit:4096,config:{rateLimit:{max:10,timeWindow:'1 minute'}},schema:{body:body({email:authEmail,challenge_id:{type:'string',format:'uuid'},code:{type:'string',pattern:'^[0-9]{6}$'},new_password:password},['email','challenge_id','code','new_password'])},
  },async request=>{
    const {store}=mailAvailable();const input=request.body;const email=input.email.trim().toLowerCase();
    const pending=await store.consumeOtp(emailKey(email),input.challenge_id,codeKey(email,input.challenge_id,input.code),'password_reset');
    if(!pending?.users_id)throw new ApiError(400,'invalid_otp','Code is invalid, expired or already used');
    const hash=await hashPassword(input.new_password);
    await db.transaction(async client=>{
      const active=await client.query("SELECT users_id FROM users WHERE users_id=$1 AND lower(email)=lower($2) AND account_status='active' FOR UPDATE",[pending.users_id,email]);
      if(!active.rowCount)throw new ApiError(400,'invalid_otp','Code is invalid, expired or already used');
      const updated=await client.query("UPDATE user_auth_accounts SET password_hash=$3 WHERE users_id=$1 AND provider='password' AND password_hash=$2 RETURNING auth_account_id",[pending.users_id,pending.password_hash,hash]);
      if(!updated.rowCount)throw new ApiError(400,'invalid_otp','The password changed; request a new reset code');
      await revoke(client,pending.users_id!);
      await client.query("INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,request_id) VALUES ($1,'auth.password.reset','user',$1,$2)",[pending.users_id,request.id]);
    });
    // Existing factors and recovery codes are retained. Reset never authenticates.
    return {changed:true,sign_in_required:true};
  });
}
