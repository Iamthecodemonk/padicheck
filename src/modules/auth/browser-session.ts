import {randomBytes} from 'node:crypto';
import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import type {Database} from '../../database/index.js';
import type {Authorization} from '../authorization/index.js';
import type {AppConfig} from '../../config.js';
import {digest} from './security.js';
import {ApiError} from '../../errors.js';

const name='padicheck_session';
const path='/v1/auth/session';
const duration=7*24*60*60;
const issuance=new Set(['/v1/auth/login','/v1/auth/register/verify','/v1/auth/google','/v1/auth/mfa/verify']);
function cookie(request:FastifyRequest){const values=(request.headers.cookie??'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(name+'='));return values.length===1?values[0]!.slice(name.length+1):'';}
function setCookie(request:FastifyRequest,reply:FastifyReply,value:string,seconds:number,production:boolean){
 const secure=production||request.protocol==='https'||String(request.headers['x-forwarded-proto']??'').split(',')[0]?.trim()==='https';
 reply.header('Set-Cookie',`${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0,Math.floor(seconds))}${secure?'; Secure':''}`);
}
export async function browserSessionRoutes(app:FastifyInstance,db:Database,access:Authorization,config:AppConfig){
 const production=config.nodeEnv==='production';
 const clear=(request:FastifyRequest,reply:FastifyReply)=>setCookie(request,reply,'',0,production);
 app.addHook('onSend',async(request,reply,payload)=>{
 const url=request.url.split('?')[0]!;
 if(url.startsWith('/v1/auth'))reply.header('Cache-Control','no-store');
 if(url===path&&reply.statusCode===401)clear(request,reply);
 if(url==='/v1/auth/logout'&&reply.statusCode===204)clear(request,reply);
 if(!issuance.has(url)||reply.statusCode>=400||typeof payload!=='string')return payload;
 const result=JSON.parse(payload) as {access_token?:string;mfa_required?:boolean;expires_in?:number};
 if(!result.access_token||result.mfa_required)return payload;
 if(config.platformEnabled){
 const jwt=app.jwt.decode<{sub:string;jti:string;stage?:string}>(result.access_token);
 if(!jwt||jwt.stage!=='access')return payload;
 const token=randomBytes(32).toString('base64url');
 const saved=await db.query(`UPDATE auth_sessions SET browser_token_hash=$3,browser_jti=$4,browser_expires_at=now()+interval '7 days'
 WHERE users_id=$1 AND jti_hash=$2 AND revoked_at IS NULL RETURNING session_id`,[jwt.sub,digest(jwt.jti),digest(token),jwt.jti]);
 if(!saved.rowCount)throw new ApiError(401,'unauthorized','Session is unavailable');
 setCookie(request,reply,token,duration,production);
 }else setCookie(request,reply,result.access_token,Math.min(result.expires_in??900,900),production);
 return payload;
 });
 const browserOnly=async(request:FastifyRequest)=>{
 // A cross-site form cannot set this custom header; no cross-origin CORS is enabled.
 if(request.headers['x-padicheck-session']!=='1')throw new ApiError(403,'session_request_forbidden','Use the same-origin browser session flow');
 if(request.headers['sec-fetch-site']==='cross-site')throw new ApiError(403,'session_request_forbidden','Cross-site session requests are forbidden');
 };
 app.post(path,{onRequest:browserOnly,config:{rateLimit:{max:60,timeWindow:'1 minute'}}},async(request,reply)=>{
 const token=cookie(request);
 if(config.platformEnabled){
 if(!/^[a-zA-Z0-9_-]{43}$/.test(token))throw new ApiError(401,'unauthorized','No browser session');
 return db.transaction(async client=>{
 const candidate=(await client.query('SELECT users_id FROM auth_sessions WHERE browser_token_hash=$1',[digest(token)])).rows[0];
 if(!candidate)throw new ApiError(401,'unauthorized','Browser session expired');
 // Same lock order as security mutations, serializing renewal with revocation.
 const user=(await client.query("SELECT users_id FROM users WHERE users_id=$1 AND account_status='active' FOR UPDATE",[candidate.users_id])).rows[0];
 const session=(await client.query(`SELECT session_id,browser_jti,browser_expires_at FROM auth_sessions WHERE users_id=$1 AND browser_token_hash=$2
 AND revoked_at IS NULL AND browser_expires_at>now() FOR UPDATE`,[candidate.users_id,digest(token)])).rows[0];
 if(!user||!session?.browser_jti)throw new ApiError(401,'unauthorized','Browser session expired or revoked');
 const access_token=app.jwt.sign({sub:user.users_id,jti:session.browser_jti,stage:'access'});
 const jwt=app.jwt.decode<{exp:number}>(access_token)!;
 await client.query('UPDATE auth_sessions SET expires_at=to_timestamp($2) WHERE session_id=$1',[session.session_id,jwt.exp]);
 // Absolute browser expiry and original authenticated_at are never extended.
 setCookie(request,reply,token,Math.ceil((new Date(session.browser_expires_at).getTime()-Date.now())/1000),production);
 return {access_token,token_type:'Bearer',expires_in:Math.max(0,jwt.exp-Math.floor(Date.now()/1000))};
 });
 }
 if(!token||token.length>4096)throw new ApiError(401,'unauthorized','No browser session');
 request.headers.authorization='Bearer '+token;
 await access.authenticate(request);
 return {access_token:token,token_type:'Bearer',expires_in:Math.max(0,(request.user.exp??0)-Math.floor(Date.now()/1000))};
 });
 app.delete(path,{onRequest:browserOnly},async(request,reply)=>{
 const token=cookie(request);
 if(config.platformEnabled&&/^[a-zA-Z0-9_-]{43}$/.test(token))await db.query('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE browser_token_hash=$1',[digest(token)]);
 clear(request,reply);return reply.code(204).send();
 });
}
