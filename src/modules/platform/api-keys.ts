import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization, Principal } from '../authorization/index.js';
import { digest, lockSecurityAccount } from '../auth/security.js';
import { ApiError } from '../../errors.js';
import { body, params, text, audit } from '../trust/shared.js';

const fields='api_key_id,name,key_prefix,scopes,created_at,expires_at,revoked_at,last_used_at';
const scopes=['investigations:read','investigations:create'];
export async function apiKeyRoutes(app:FastifyInstance,db:Database,access:Authorization,enabled:boolean){
  const auth=async(request:FastifyRequest)=>{if(!enabled)throw new ApiError(503,'platform_unavailable','Platform extension is not enabled');await access.authenticate(request);};
  const recent=async(request:FastifyRequest)=>{
    await auth(request);if(!request.principal!.email_verified_at)throw new ApiError(403,'verified_email_required','Verify your email before creating API keys');
    const result=await db.query(`SELECT 1 FROM auth_sessions WHERE users_id=$1 AND jti_hash=$2 AND revoked_at IS NULL AND expires_at>now()
      AND authenticated_at>now()-interval '5 minutes'`,[request.principal!.users_id,digest(request.user.jti??'')]);
    if(!result.rowCount)throw new ApiError(403,'recent_login_required','Sign in again before creating API credentials');
  };
  app.addHook('onSend',async(request,reply,payload)=>{if(request.url.startsWith('/v1/me/api-keys'))reply.header('Cache-Control','no-store');return payload;});
  app.get('/v1/me/api-keys',{onRequest:auth},async request=>({api_keys:(await db.query(`SELECT ${fields} FROM user_api_keys WHERE users_id=$1 ORDER BY created_at DESC,api_key_id LIMIT 100`,[request.principal!.users_id])).rows}));
  app.post<{Body:{name:string;scopes:string[];expires_in_days?:number}}>('/v1/me/api-keys',{onRequest:recent,config:{rateLimit:{max:5,timeWindow:'1 minute'}},
    schema:{body:body({name:text(80),scopes:{type:'array',minItems:1,maxItems:2,uniqueItems:true,items:{type:'string',enum:scopes}},
      expires_in_days:{type:'integer',minimum:1,maximum:90,default:30}},['name','scopes'])}},async(request,reply)=>{
    for(const scope of request.body.scopes)if(!access.can(request.principal!,scope==='investigations:read'?'investigations.read_own':'investigations.create'))throw new ApiError(403,'scope_forbidden','Account does not have this permission');
    const secret=`pc_key_${randomBytes(32).toString('base64url')}`;
    const api_key=await db.transaction(async client=>{
      await lockSecurityAccount(client,request);
      const count=await client.query('SELECT count(*)::integer AS count FROM user_api_keys WHERE users_id=$1 AND revoked_at IS NULL AND expires_at>now()',[request.principal!.users_id]);
      if(count.rows[0]!.count>=20)throw new ApiError(409,'api_key_limit','Revoke an existing API key first');
      const row=(await client.query(`INSERT INTO user_api_keys(users_id,name,key_prefix,key_hash,scopes,expires_at)
        VALUES ($1,$2,$3,$4,$5,now()+($6::integer*interval '1 day')) RETURNING ${fields}`,
      [request.principal!.users_id,request.body.name.trim(),secret.slice(0,16),digest(secret),request.body.scopes,request.body.expires_in_days??30])).rows[0]!;
      await audit(client,request,'api_key.create','api_key',row.api_key_id,null,{name:row.name,scopes:row.scopes});return row;
    });return reply.code(201).send({api_key,secret});
  });
  app.delete<{Params:{id:string}}>('/v1/me/api-keys/:id',{onRequest:auth,schema:{params:params('id')}},async(request,reply)=>{
    await db.transaction(async client=>{
      const row=(await client.query('UPDATE user_api_keys SET revoked_at=COALESCE(revoked_at,now()) WHERE api_key_id=$1 AND users_id=$2 RETURNING api_key_id',[request.params.id,request.principal!.users_id])).rows[0];
      if(!row)throw new ApiError(404,'api_key_not_found','API key was not found');await audit(client,request,'api_key.revoke','api_key',request.params.id,null,{});
    });return reply.code(204).send();
  });
  app.post<{Params:{id:string}}>('/v1/me/api-keys/:id/rotate',{onRequest:recent,schema:{params:params('id')},config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async(request,reply)=>{
    const secret=`pc_key_${randomBytes(32).toString('base64url')}`;
    const api_key=await db.transaction(async client=>{
      await lockSecurityAccount(client,request);
      const before=(await client.query('UPDATE user_api_keys SET revoked_at=now() WHERE users_id=$1 AND api_key_id=$2 AND revoked_at IS NULL AND expires_at>now() RETURNING *',[request.principal!.users_id,request.params.id])).rows[0];
      if(!before)throw new ApiError(404,'api_key_not_found','Active API key was not found');
      const row=(await client.query(`INSERT INTO user_api_keys(users_id,name,key_prefix,key_hash,scopes,expires_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${fields}`,
      [request.principal!.users_id,before.name,secret.slice(0,16),digest(secret),before.scopes,before.expires_at])).rows[0]!;
      await audit(client,request,'api_key.rotate','api_key',request.params.id,null,{replacement_id:row.api_key_id});return row;
    });return reply.code(201).send({api_key,secret});
  });
}

// Reuse existing investigation contracts, limited to owned data and live permissions.
export async function apiKeyPrincipal(db:Database,request:FastifyRequest):Promise<Principal>{
  const key=request.headers['x-api-key'];
  if(typeof key!=='string'||!/^pc_key_[A-Za-z0-9_-]{43}$/.test(key))throw new ApiError(401,'invalid_api_key','API key is invalid');
  const path=request.url.split('?')[0]!;
  const read=request.method==='GET'&&/^\/v1\/investigations(?:\/[a-f0-9-]{36}(?:\/(?:findings|sources|model-runs))?)?$/i.test(path);
  const create=request.method==='POST'&&path==='/v1/investigations';
  if(!read&&!create)throw new ApiError(403,'api_key_scope_forbidden','API keys cannot access this operation');
  const required=create?'investigations:create':'investigations:read';
  // A shared per-key minute window prevents process-local rate-limit bypass.
  const keyRow=(await db.query<{api_key_id:string;users_id:string;scopes:string[]}>(`UPDATE user_api_keys SET last_used_at=now(),
    rate_count=CASE WHEN rate_window=date_trunc('minute',now()) THEN rate_count+1 ELSE 1 END,rate_window=date_trunc('minute',now())
    WHERE key_hash=$1 AND revoked_at IS NULL AND expires_at>now()
    AND (rate_window<>date_trunc('minute',now()) OR rate_count<60) RETURNING api_key_id,users_id,scopes`,[digest(key)])).rows[0];
  if(!keyRow){
    const existing=await db.query('SELECT 1 FROM user_api_keys WHERE key_hash=$1 AND revoked_at IS NULL AND expires_at>now()',[digest(key)]);
    if(existing.rowCount)throw new ApiError(429,'api_key_rate_limited','API key minute limit reached');
    throw new ApiError(401,'invalid_api_key','API key is invalid, expired or revoked');
  }
  if(!keyRow.scopes.includes(required))throw new ApiError(403,'api_key_scope_forbidden','API key scope is insufficient');
  const owner=(await db.query<Principal>(`SELECT u.users_id,u.display_name,u.email,u.email_verified_at,
    COALESCE(array_agg(DISTINCT r.role_key) FILTER(WHERE r.role_key IS NOT NULL),'{}') AS roles,
    COALESCE(array_agg(DISTINCT p.permission_key) FILTER(WHERE p.permission_key IS NOT NULL),'{}') AS permissions
    FROM users u LEFT JOIN user_roles ur ON ur.users_id=u.users_id LEFT JOIN roles r ON r.role_id=ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id=r.role_id LEFT JOIN permissions p ON p.permission_id=rp.permission_id
    WHERE u.users_id=$1 AND u.account_status='active' AND u.email_verified_at IS NOT NULL GROUP BY u.users_id`,[keyRow.users_id])).rows[0];
  if(!owner)throw new ApiError(401,'invalid_api_key','Account is unavailable');
  const wildcard=owner.roles.includes('superadmin')&&owner.permissions.includes('*');
  const permissions:string[]=[];
  if(keyRow.scopes.includes('investigations:read')&&(wildcard||owner.permissions.includes('investigations.read_own')))permissions.push('investigations.read_own');
  if(keyRow.scopes.includes('investigations:create')&&(wildcard||owner.permissions.includes('investigations.create')))permissions.push('investigations.create');
  return {...owner,roles:['api_client'],permissions};
}
