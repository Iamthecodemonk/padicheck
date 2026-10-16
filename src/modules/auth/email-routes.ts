import { createHmac, randomInt, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import type { AuthDependencies, PendingOtp } from './identity-types.js';
import { hashPassword } from './password.js';
import { authSession, type AuthUser } from './session.js';
import { ApiError } from '../../errors.js';

export const authEmail={type:'string',format:'email',maxLength:254};
const verification={type:'object',additionalProperties:false,required:['email','challenge_id','code'],properties:{
  email:authEmail,challenge_id:{type:'string',format:'uuid'},code:{type:'string',pattern:'^[0-9]{6}$'},
}};
type Verify={email:string;challenge_id:string;code:string};
export const authKey=(secret:string,purpose:string,value:string)=>createHmac('sha256',secret).update(`${purpose}:${value}`).digest('hex');

export async function emailAuthRoutes(app:FastifyInstance,db:Database,access:Authorization,auth:AuthDependencies,secret:string){
  function available(){if(!auth.challenges||!auth.mailer)throw new ApiError(503,'email_auth_unavailable','Email verification is not configured');return {store:auth.challenges,mailer:auth.mailer};}
  const emailKey=(email:string)=>authKey(secret,'email',email.trim().toLowerCase());
  const codeKey=(email:string,id:string,code:string,purpose:string)=>authKey(secret,`otp:${purpose}`,`${emailKey(email)}:${id}:${code}`);
  async function issue(pending:Omit<PendingOtp,'challenge_id'|'code_digest'>,deliver=true){
    const {store,mailer}=available();
    const id=randomUUID();const code=String(randomInt(0,1000000)).padStart(6,'0');
    const record={...pending,challenge_id:id,code_digest:codeKey(pending.email,id,code,pending.purpose)};
    if(!await store.putOtp(emailKey(pending.email),record))throw new ApiError(429,'otp_rate_limited','Wait before requesting another code');
    if(deliver){
      try{await mailer.sendCode(pending.email,code);}
      catch{await store.discardOtp(emailKey(pending.email),id);throw new ApiError(503,'email_delivery_failed','The verification email could not be sent');}
    }
    return {challenge_id:id,expires_in:600,message:'If eligible, a verification code has been sent to this email.'};
  }
  async function consume(input:Verify,purpose:PendingOtp['purpose']){
    const {store}=available();const email=input.email.trim().toLowerCase();
    const pending=await store.consumeOtp(emailKey(email),input.challenge_id,codeKey(email,input.challenge_id,input.code,purpose),purpose);
    if(!pending)throw new ApiError(400,'invalid_otp','Code is invalid, expired or already used');
    return pending;
  }
  app.post<{Body:{display_name:string;email:string;password:string}}>('/v1/auth/register',{
    bodyLimit:4096,config:{rateLimit:{max:10,timeWindow:'1 minute'}},schema:{body:{type:'object',additionalProperties:false,
      required:['display_name','email','password'],properties:{display_name:{type:'string',minLength:1,maxLength:120},email:authEmail,
        password:{type:'string',minLength:12,maxLength:128}}}},
  },async(request,reply)=>{
    available();const email=request.body.email.trim().toLowerCase();const name=request.body.display_name.trim();
    if(!name)throw new ApiError(400,'invalid_display_name','Display name must not be blank');
    const hash=await hashPassword(request.body.password);
    const existing=await db.query('SELECT 1 FROM users WHERE lower(email)=lower($1)',[email]);
    return reply.code(202).send(await issue({purpose:'signup',email,display_name:name,password_hash:hash},!existing.rowCount));
  });
  app.post<{Body:Verify}>('/v1/auth/register/verify',{
    bodyLimit:1024,config:{rateLimit:{max:30,timeWindow:'1 minute'}},schema:{body:verification},
  },async(request,reply)=>{
    const pending=await consume(request.body,'signup');
    try{
      const user=await db.transaction(async client=>{
        const row=(await client.query<AuthUser>(`INSERT INTO users (display_name,email,email_verified_at,last_login_at)
          VALUES ($1,$2,now(),now()) RETURNING users_id,display_name,email,account_status,email_verified_at`,[pending.display_name,pending.email])).rows[0]!;
        await client.query(`INSERT INTO user_auth_accounts (users_id,provider,password_hash,provider_email,last_used_at)
          VALUES ($1,'password',$2,$3,now())`,[row.users_id,pending.password_hash,row.email]);
        return row;
      });
      return reply.code(201).send(authSession(app,user));
    }catch(error){if((error as {code?:string}).code==='23505')throw new ApiError(409,'account_exists','An account with this email already exists');throw error;}
  });
  app.post('/v1/auth/email/request',{
    onRequest:access.authenticate,config:{rateLimit:{max:10,timeWindow:'1 minute'}},
  },async(request,reply)=>reply.code(202).send(await issue({purpose:'verify_email',email:request.principal!.email.trim().toLowerCase(),users_id:request.principal!.users_id})));
  app.post<{Body:Verify}>('/v1/auth/email/verify',{
    onRequest:access.authenticate,bodyLimit:1024,config:{rateLimit:{max:30,timeWindow:'1 minute'}},schema:{body:verification},
  },async request=>{
    if(request.body.email.trim().toLowerCase()!==request.principal!.email.trim().toLowerCase())throw new ApiError(400,'invalid_otp','Code is invalid, expired or already used');
    const pending=await consume(request.body,'verify_email');
    if(pending.users_id!==request.principal!.users_id)throw new ApiError(400,'invalid_otp','Code is invalid, expired or already used');
    const row=(await db.query(`UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()) WHERE users_id=$1
      AND lower(email)=lower($2) AND account_status='active' RETURNING users_id,email_verified_at`,[pending.users_id,pending.email])).rows[0];
    if(!row)throw new ApiError(401,'unauthorized','Account is unavailable');
    return {email_verified:true};
  });
}
