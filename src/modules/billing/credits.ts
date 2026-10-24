import type {Database,SqlExecutor} from '../../database/index.js';
import type {FastifyInstance} from 'fastify';
import type {Authorization} from '../authorization/index.js';
import type {AppConfig} from '../../config.js';
import type {CreateInvestigation} from '../investigations/types.js';
import {ApiError} from '../../errors.js';
import {audit,body} from '../trust/shared.js';

export const creditTypes=['company_research','phone_lookup','property','job_search','web_analysis','contract_review','general_research','shopping','freelance','person','social','listing'] as const;
type CreditType=typeof creditTypes[number];
type Policy={environment:string;welcome_credits:number;costs:Record<CreditType,number>;revision:number;updated_at:string};
export async function creditPolicy(db:SqlExecutor,environment:string,lock=false){
 const row=(await db.query<Policy>('SELECT * FROM credit_policies WHERE environment=$1'+(lock?' FOR SHARE':''),[environment])).rows[0];
 if(!row)throw new ApiError(503,'credits_unavailable','Credit policy has not been configured');return row;
}
export const creditType=(input:CreateInvestigation):CreditType=>{
 const context=input.input_data?.check_context;
 return context&&['property','shopping','freelance','person','social','listing'].includes(context)?context as CreditType:input.investigation_type;
};
export const availableGrants=`FROM billing_grants g WHERE g.users_id=$1 AND g.environment=$2 AND g.revoked_at IS NULL
 AND g.valid_from<=now() AND (g.expires_at IS NULL OR g.expires_at>now())
 AND (g.billing_subscription_id IS NULL OR EXISTS(SELECT 1 FROM billing_subscriptions s WHERE s.billing_subscription_id=g.billing_subscription_id AND s.provider_status NOT IN ('unpaid','paused')))`;
export async function awardWelcome(client:SqlExecutor,userId:string,environment:string){
 const policy=await creditPolicy(client,environment,true);
 const award=await client.query(`INSERT INTO welcome_credit_awards(users_id,environment,amount,policy_revision)
 VALUES($1,$2,$3,$4) ON CONFLICT(users_id) DO NOTHING RETURNING users_id`,[userId,environment,policy.welcome_credits,policy.revision]);
 if(award.rowCount&&policy.welcome_credits>0)await client.query(`INSERT INTO billing_grants(users_id,environment,source_type,provider_source_id,units_granted,valid_from)
 VALUES($1::uuid,$2,'welcome',$1::text,$3,now())`,[userId,environment,policy.welcome_credits]);
}
export async function consumeCredits(client:SqlExecutor,userId:string,id:string,environment:string,input:CreateInvestigation){
 // Lock the user before grants; concurrent requests cannot spend the same balance.
 // NO KEY UPDATE is compatible with investigation INSERT FK key-share locks.
 await client.query('SELECT users_id FROM users WHERE users_id=$1 FOR NO KEY UPDATE',[userId]);
 if((await client.query('SELECT 1 FROM credit_charges WHERE investigation_id=$1',[id])).rowCount)return;
 const policy=await creditPolicy(client,environment,true);const kind=creditType(input);const amount=policy.costs[kind];
 if(!Number.isInteger(amount)||amount<0)throw new ApiError(503,'credits_unavailable','This check has no valid price');
 if(input.expected_credit_cost!==undefined&&input.expected_credit_cost!==amount)throw new ApiError(409,'credit_price_changed','The credit cost changed. Review the current price and confirm again.');
 const grants=(await client.query<{billing_grant_id:string;remaining:number}>(`SELECT g.billing_grant_id,g.units_granted-g.units_used AS remaining ${availableGrants}
 AND g.units_used<g.units_granted ORDER BY g.expires_at ASC NULLS LAST,g.created_at,g.billing_grant_id FOR UPDATE OF g`,[userId,environment])).rows;
 if(grants.reduce((sum,g)=>sum+g.remaining,0)<amount)throw new ApiError(402,'insufficient_credits','You do not have enough credits for this check');
 let remaining=amount;
 for(const grant of grants){if(!remaining)break;const units=Math.min(remaining,grant.remaining);
 await client.query('UPDATE billing_grants SET units_used=units_used+$2 WHERE billing_grant_id=$1',[grant.billing_grant_id,units]);
 await client.query('INSERT INTO billing_usage(investigation_id,users_id,billing_grant_id,units) VALUES($1,$2,$3,$4)',[id,userId,grant.billing_grant_id,units]);remaining-=units;}
 await client.query('INSERT INTO credit_charges(investigation_id,users_id,environment,check_type,amount,policy_revision) VALUES($1,$2,$3,$4,$5,$6)',[id,userId,environment,kind,amount,policy.revision]);
}
export async function creditRoutes(app:FastifyInstance,db:Database,access:Authorization,config:AppConfig){
 const environment=config.bachsEnvironment;
 app.addHook('onSend',async(request,reply,payload)=>{if(request.url.startsWith('/v1/credits')||request.url.startsWith('/v1/admin/credits'))reply.header('Cache-Control','no-store');return payload;});
 const admin=async(request:Parameters<typeof access.authenticate>[0])=>{await access.authenticate(request);if(!request.principal!.roles.includes('superadmin'))throw new ApiError(403,'superadmin_required','Credit settings require superadmin access');};
 const amount={type:'integer',minimum:0,maximum:100000};
 const costs=body(Object.fromEntries(creditTypes.map(key=>[key,amount])),[...creditTypes]);
 app.get('/v1/credits/policy',async()=>({enabled:config.creditsEnabled,policy:config.creditsEnabled?await creditPolicy(db,environment):null}));
 app.get('/v1/admin/credits/policy',{onRequest:admin},async()=>({enabled:config.creditsEnabled,policy:await creditPolicy(db,environment)}));
 app.put<{Body:{welcome_credits:number;costs:Record<CreditType,number>;revision:number}}>('/v1/admin/credits/policy',{
 onRequest:admin,schema:{body:body({welcome_credits:amount,costs,revision:{type:'integer',minimum:1}},['welcome_credits','costs','revision'])}
 },async request=>db.transaction(async client=>{
 const before=(await client.query<Policy>('SELECT * FROM credit_policies WHERE environment=$1 FOR UPDATE',[environment])).rows[0]!;
 if(before.revision!==request.body.revision)throw new ApiError(409,'credit_policy_changed','Another admin updated these settings. Reload before saving.');
 const after=(await client.query<Policy>('UPDATE credit_policies SET welcome_credits=$2,costs=$3::jsonb,revision=revision+1,updated_at=now() WHERE environment=$1 RETURNING *',[environment,request.body.welcome_credits,JSON.stringify(request.body.costs)])).rows[0]!;
 // target_id is UUID in the existing audit table; no synthetic/non-UUID policy ID.
 await audit(client,request,'credits.policy.update','credit_policy',request.principal!.users_id,before,after);
 return {enabled:config.creditsEnabled,policy:after};
 }));
 app.get('/v1/credits/me',{onRequest:access.authenticate},async request=>{
 if(!config.creditsEnabled)return {enabled:false,available_units:0,transactions:[]};
 const user=request.principal!.users_id;
 const balance=(await db.query(`SELECT COALESCE(sum(g.units_granted-g.units_used),0)::text AS units ${availableGrants}`,[user,environment])).rows[0]!;
 const history=await db.query(`SELECT billing_grant_id::text AS id,CASE WHEN source_type='welcome' THEN 'Welcome credits' ELSE 'Purchased credits' END AS label,
 units_granted AS amount,created_at AS at FROM billing_grants WHERE users_id=$1 AND environment=$2
 UNION ALL SELECT investigation_id::text AS id,'Check: '||check_type AS label,-amount AS amount,created_at AS at FROM credit_charges WHERE users_id=$1 AND environment=$2
 ORDER BY at DESC,id DESC LIMIT 100`,[user,environment]);
 return {enabled:true,available_units:Number(balance.units),transactions:history.rows};
 });
}
