import {createHash} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import type {Database,SqlExecutor} from '../../database/index.js';
import type {AppConfig} from '../../config.js';
import type {Authorization} from '../authorization/index.js';
import type {BillingProvider,Json} from './types.js';
import {ApiError} from '../../errors.js';
import {body,params,text,pagination,audit} from '../trust/shared.js';
import {currencyAmount,sameMoney} from './verification.js';

const money={type:'string',pattern:'^(0|[1-9][0-9]{0,11})\\.[0-9]{2}$'};
const fields={plan_key:{type:'string',pattern:'^[a-z0-9_-]{1,50}$'},audience:{type:'string',enum:['consumer','business']},display_name:text(100),tagline:{type:'string',maxLength:200},
 currency:{type:'string',enum:['NGN']},monthly_amount:money,yearly_amount:money,monthly_credits:{type:'integer',minimum:0,maximum:100000},yearly_credits:{type:'integer',minimum:0,maximum:1000000},
 features:{type:'array',maxItems:20,items:text(150)},is_popular:{type:'boolean'},is_published:{type:'boolean'}};
const required=Object.keys(fields);
const select=`SELECT p.*,m.offer_key AS monthly_offer_key,y.offer_key AS yearly_offer_key,
 COALESCE(m.is_enabled,false) AS monthly_available,COALESCE(y.is_enabled,false) AS yearly_available
 FROM billing_plans p LEFT JOIN billing_offers m ON m.offer_id=p.monthly_offer_id AND m.environment=p.environment
 LEFT JOIN billing_offers y ON y.offer_id=p.yearly_offer_id AND y.environment=p.environment`;
async function lock(client:SqlExecutor){await client.query('SELECT pg_advisory_xact_lock($1)',[721934209]);}
function normalize(input:Json):Json{const value:Json={...input,display_name:input.display_name.trim(),tagline:input.tagline.trim(),features:[...new Set<string>((input.features as string[]).map(v=>v.trim()))]};
 if(!value.display_name||value.features.some((v:string)=>!v))throw new ApiError(400,'invalid_plan','Names and benefits must not be blank');
 for(const period of ['monthly','yearly'])if(Number(input[period+'_amount'])>0&&input[period+'_credits']<1)throw new ApiError(400,'invalid_plan','Paid plans require a credit allowance');
 return value;
}
export async function planRoutes(app:FastifyInstance,db:Database,access:Authorization,config:AppConfig,provider?:BillingProvider){
 const environment=config.bachsEnvironment;
 const admin=async(request:Parameters<typeof access.authenticate>[0])=>{await access.authenticate(request);if(!request.principal!.roles.includes('superadmin'))throw new ApiError(403,'superadmin_required','Managing plans requires superadmin access');};
 app.addHook('onSend',async(request,reply,payload)=>{if(request.url.includes('/billing/plans'))reply.header('Cache-Control','no-store');return payload;});
 app.get('/v1/billing/plans',async()=>({plans:(await db.query(select+' WHERE p.environment=$1 AND p.is_published ORDER BY p.monthly_amount,p.plan_key',[environment])).rows,billing_enabled:config.billingEnabled}));
 app.get<{Querystring:{limit?:number;offset?:number}}>('/v1/admin/billing/plans',{onRequest:admin,schema:{querystring:pagination}},async request=>({plans:(await db.query(select+' WHERE p.environment=$1 ORDER BY p.created_at,p.plan_id LIMIT $2 OFFSET $3',[environment,request.query.limit??100,request.query.offset??0])).rows}));
 app.post<{Body:Json}>('/v1/admin/billing/plans',{onRequest:admin,schema:{body:body(fields,required)}},async(request,reply)=>{
 const input=normalize(request.body);
 try{const plan=await db.transaction(async client=>{await lock(client);
 if(input.is_popular&&input.is_published)await client.query('UPDATE billing_plans SET is_popular=false,revision=revision+1,updated_at=now() WHERE environment=$1 AND audience=$2 AND is_popular',[environment,input.audience]);
 const row=(await client.query(`INSERT INTO billing_plans(environment,plan_key,audience,display_name,tagline,currency,monthly_amount,yearly_amount,monthly_credits,yearly_credits,features,is_popular,is_published)
 VALUES($1,$2,$3,$4,$5,'NGN',$6,$7,$8,$9,$10::jsonb,$11,$12) RETURNING *`,[environment,input.plan_key,input.audience,input.display_name,input.tagline,input.monthly_amount,input.yearly_amount,input.monthly_credits,input.yearly_credits,JSON.stringify(input.features),input.is_popular,input.is_published])).rows[0]!;
 await audit(client,request,'billing.plans.create','billing_plan',row.plan_id,null,row);return row;});return reply.code(201).send({plan});
 }catch(error){if((error as {code?:string}).code==='23505')throw new ApiError(409,'plan_exists','Plan key already exists');throw error;}
 });
 app.put<{Params:{id:string};Body:Json}>('/v1/admin/billing/plans/:id',{onRequest:admin,schema:{params:params('id'),body:body({...fields,revision:{type:'integer',minimum:1}},[...required,'revision'])}},async request=>db.transaction(async client=>{
 await lock(client);const before=(await client.query('SELECT * FROM billing_plans WHERE plan_id=$1 AND environment=$2 FOR UPDATE',[request.params.id,environment])).rows[0];
 if(!before)throw new ApiError(404,'plan_not_found','Plan not found');if(before.revision!==request.body.revision)throw new ApiError(409,'plan_changed','Reload the plan before saving');
 const input=normalize(request.body);if(input.plan_key!==before.plan_key)throw new ApiError(400,'plan_key_immutable','The plan key cannot be changed');
 if(input.is_popular&&input.is_published)await client.query('UPDATE billing_plans SET is_popular=false,revision=revision+1,updated_at=now() WHERE environment=$1 AND audience=$2 AND plan_id<>$3 AND is_popular',[environment,input.audience,before.plan_id]);
 const termsChanged=['monthly_amount','yearly_amount'].some(k=>!sameMoney(String(before[k]),input[k]))||['monthly_credits','yearly_credits'].some(k=>before[k]!==input[k]);
 if(termsChanged||!input.is_published){await client.query('UPDATE billing_offers SET is_enabled=false WHERE plan_id=$1',[before.plan_id]);}
 const row=(await client.query(`UPDATE billing_plans SET audience=$2,display_name=$3,tagline=$4,monthly_amount=$5,yearly_amount=$6,monthly_credits=$7,yearly_credits=$8,features=$9::jsonb,is_popular=$10,is_published=$11,
 monthly_offer_id=CASE WHEN $12 THEN NULL ELSE monthly_offer_id END,yearly_offer_id=CASE WHEN $12 THEN NULL ELSE yearly_offer_id END,revision=revision+1,updated_at=now() WHERE plan_id=$1 RETURNING *`,
 [before.plan_id,input.audience,input.display_name,input.tagline,input.monthly_amount,input.yearly_amount,input.monthly_credits,input.yearly_credits,JSON.stringify(input.features),input.is_popular,input.is_published,termsChanged])).rows[0]!;
 await audit(client,request,'billing.plans.update','billing_plan',before.plan_id,before,row);return {plan:row};
 }));
 app.post<{Params:{id:string}}>('/v1/admin/billing/plans/:id/enable-checkout',{onRequest:admin,schema:{params:params('id'),body:body({acknowledge_manual_renewal:{type:'boolean',const:true}},['acknowledge_manual_renewal'])}},async request=>{
 if(!config.billingEnabled||!provider?.createProduct||!provider.product)throw new ApiError(503,'billing_unavailable','Configure Bachs before enabling naira checkout');
 return db.transaction(async client=>{
 await lock(client);const plan=(await client.query('SELECT * FROM billing_plans WHERE plan_id=$1 AND environment=$2 FOR UPDATE',[request.params.id,environment])).rows[0];if(!plan)throw new ApiError(404,'plan_not_found','Plan not found');
 if(!plan.is_published)throw new ApiError(400,'plan_unpublished','Publish the plan first');let count=0;
 for(const [period,days] of [['monthly',30],['yearly',365]] as const){
 const amount=currencyAmount(plan[period+'_amount']);const units=plan[period+'_credits'];if(Number(amount)===0)continue;
 if(!Number.isInteger(units)||units<1)throw new ApiError(400,'invalid_plan','Choose a credit allowance before enabling paid checkout');
 if(Number(amount)<100)throw new ApiError(400,'plan_minimum','Naira paid plans require at least NGN 100');
 const fingerprint=createHash('sha256').update(JSON.stringify([amount,units,days])).digest('hex').slice(0,12);
 const product=await provider.createProduct!({name:plan.plan_key+' - '+days+' day pass',price:{price_type:'fixed',currency:'NGN',amount}},'padi-plan-'+plan.plan_id+'-'+period+'-'+fingerprint);
 const id=product.product_id??product.id;if(!/^prod_[a-zA-Z0-9_-]+$/.test(id??''))throw new ApiError(502,'invalid_billing_response','Invalid plan product');
 const verified=await provider.product!(id);
 if(verified.price?.currency!=='NGN'||!sameMoney(verified.price?.amount,amount)||verified.billing_cycle||verified.archived===true)throw new ApiError(409,'plan_product_mismatch','Provider product does not match this naira pass');
 const offer=(await client.query(`INSERT INTO billing_offers(environment,offer_key,display_name,billing_mode,provider_product_id,currency,amount,investigation_units,is_enabled,plan_id,validity_days)
 VALUES($1,$2,$3,'one_time',$4,'NGN',$5,$6,true,$7,$8) ON CONFLICT(environment,provider_product_id) DO UPDATE SET is_enabled=true RETURNING *`,[environment,'plan_'+plan.plan_key+'_'+period+'_'+fingerprint,plan.display_name+' - '+days+' days',id,amount,units,plan.plan_id,days])).rows[0]!;
 if(offer.plan_id!==plan.plan_id||offer.validity_days!==days||offer.investigation_units!==units||!sameMoney(offer.amount,amount))throw new ApiError(409,'plan_product_mismatch','Existing offer does not match this pass');
 await client.query(period==='monthly'?'UPDATE billing_plans SET monthly_offer_id=$2 WHERE plan_id=$1':'UPDATE billing_plans SET yearly_offer_id=$2 WHERE plan_id=$1',[plan.plan_id,offer.offer_id]);count++;
 }
 if(!count)throw new ApiError(400,'free_plan','Free plans do not need a payment checkout');
 await client.query('UPDATE billing_plans SET revision=revision+1,updated_at=now() WHERE plan_id=$1',[plan.plan_id]);
 await audit(client,request,'billing.plans.enable_manual_checkout','billing_plan',plan.plan_id,null,{plan_id:plan.plan_id,manual_renewal:true,periods:count});
 return {enabled:true,manual_renewal:true};
 });
 });
}
