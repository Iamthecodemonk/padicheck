import {billingHistory} from './history.js';
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { AppConfig } from '../../config.js';
import type { Authorization } from '../authorization/index.js';
import type { BillingProvider, Checkout, Json } from './types.js';
import { ApiError } from '../../errors.js';
import { body, pagination, params, text, uuid, audit } from '../trust/shared.js';
import { billingReadiness, checkoutDto, eventFacts, newCheckout, processBillingEvent } from './service.js';
import { verifyWebhook, date } from './verification.js';
import { providerUrl } from '../../adapters/bachs.js';

export async function billingRoutes(app:FastifyInstance,db:Database,access:Authorization,config:AppConfig,provider?:BillingProvider){
  const environment=config.bachsEnvironment;
  const available=()=>{if(!config.billingEnabled||!config.bachs||!provider)throw new ApiError(503,'billing_unavailable','Payments are not enabled');return {settings:config.bachs,provider};};
  app.addHook('onSend',async(request,reply,payload)=>{if(request.url.includes('/billing')||request.url.startsWith('/v1/webhooks/bachs'))reply.header('Cache-Control','no-store');return payload;});
  app.get('/v1/billing/offers',async()=>{
    if(!config.billingEnabled)return {enabled:false,offers:[]};available();
    const rows=await db.query(`SELECT offer_key,display_name,billing_mode,currency,amount,investigation_units,plan_id,validity_days FROM billing_offers
      WHERE environment=$1 AND is_enabled ORDER BY offer_key`,[environment]);
    return {enabled:true,offers:rows.rows};
  });
  app.get<{Querystring:{limit?:number;offset?:number}}>('/v1/billing/history',{
    onRequest:access.authenticate,schema:{querystring:pagination},
  },async request=>{
    try{await billingReadiness(db);}catch{throw new ApiError(503,'billing_schema_unavailable','Billing history is unavailable');}
    return billingHistory(db,request.principal!.users_id,environment,request.query.limit??20,request.query.offset??0);
  });
  app.get('/v1/billing/me',{onRequest:access.authenticate},async request=>{
    if(!config.billingEnabled&&!config.creditsEnabled)return {enabled:false,available_units:0,subscriptions:[]};
    const units=await db.query(`SELECT COALESCE(sum(g.units_granted-g.units_used),0)::text AS units FROM billing_grants g
      WHERE g.users_id=$1 AND g.environment=$2 AND g.revoked_at IS NULL AND g.valid_from<=now()
      AND (g.expires_at IS NULL OR g.expires_at>now()) AND (g.billing_subscription_id IS NULL OR EXISTS
      (SELECT 1 FROM billing_subscriptions s WHERE s.billing_subscription_id=g.billing_subscription_id AND s.provider_status NOT IN ('unpaid','paused')))`,[request.principal!.users_id,environment]);
    const subscriptions=await db.query(`SELECT billing_subscription_id,provider_status,current_period_start,current_period_end,cancel_at_period_end
      FROM billing_subscriptions WHERE users_id=$1 AND environment=$2 ORDER BY created_at DESC LIMIT 100`,[request.principal!.users_id,environment]);
    return {enabled:true,available_units:Number(units.rows[0]!.units),subscriptions:subscriptions.rows};
  });
  app.post<{Body:{offer_key:string;request_key:string}}>('/v1/billing/checkouts',{
    onRequest:access.authenticate,bodyLimit:1024,config:{rateLimit:{max:10,timeWindow:'1 minute'}},
    schema:{body:body({offer_key:text(80),request_key:uuid},['offer_key','request_key'])},
  },async(request,reply)=>{
    const active=available();
    if(!request.principal!.email_verified_at)throw new ApiError(403,'verified_email_required','Verify your email before purchasing');
    const checkout=await newCheckout(db,active.provider,active.settings,request.principal!,request.body.offer_key,request.body.request_key);
    return reply.code(201).send({checkout});
  });
  app.get<{Params:{id:string}}>('/v1/billing/checkouts/:id',{onRequest:access.authenticate,schema:{params:params('id')}},async request=>{
    available();const row=(await db.query<Checkout>('SELECT * FROM billing_checkouts WHERE billing_checkout_id=$1 AND users_id=$2 AND environment=$3',[request.params.id,request.principal!.users_id,environment])).rows[0];
    if(!row)throw new ApiError(404,'checkout_not_found','Checkout was not found');
    return {checkout:checkoutDto(row)};
  });
  app.post<{Body:{billing_subscription_id:string}}>('/v1/billing/portal',{
    onRequest:access.authenticate,config:{rateLimit:{max:10,timeWindow:'1 minute'}},
    schema:{body:body({billing_subscription_id:uuid},['billing_subscription_id'])},
  },async request=>{
    const active=available();const row=(await db.query('SELECT provider_customer_id FROM billing_subscriptions WHERE billing_subscription_id=$1 AND users_id=$2 AND environment=$3',[request.body.billing_subscription_id,request.principal!.users_id,environment])).rows[0];
    if(!row)throw new ApiError(404,'subscription_not_found','Subscription was not found');
    const session=await active.provider.portal(row.provider_customer_id);
    return {url:providerUrl(session.url,environment,'portal')};
  });
  // Existing superadmin role is the authority; no new wildcard permissions or
  // unaudited direct SQL product configuration is needed.
  const superadmin=async(request:Parameters<typeof access.authenticate>[0])=>{
    await access.authenticate(request);if(!request.principal!.roles.includes('superadmin'))throw new ApiError(403,'superadmin_required','Billing offers require superadmin access');
    try{await billingReadiness(db);}catch{throw new ApiError(503,'billing_schema_unavailable','Apply the billing migration first');}
  };
  app.get<{Querystring:{limit?:number;offset?:number}}>('/v1/admin/billing/offers',{
    onRequest:superadmin,schema:{querystring:pagination},
  },async request=>({offers:(await db.query('SELECT * FROM billing_offers WHERE environment=$1 ORDER BY offer_key LIMIT $2 OFFSET $3',[environment,request.query.limit??20,request.query.offset??0])).rows}));
  app.post<{Body:Json}>('/v1/admin/billing/offers',{
    onRequest:superadmin,schema:{body:body({offer_key:{type:'string',pattern:'^[a-z0-9_-]{1,80}$'},display_name:text(120),
      billing_mode:{type:'string',enum:['one_time','subscription']},provider_product_id:{type:'string',pattern:'^prod_[a-zA-Z0-9_-]{1,200}$'},
      currency:{type:'string',enum:['USD','NGN']},amount:{type:'string',pattern:'^(0|[1-9][0-9]{0,11})\\.[0-9]{2}$'},
      investigation_units:{type:'integer',minimum:1,maximum:100000},is_enabled:{type:'boolean',default:false}},
    ['offer_key','display_name','billing_mode','provider_product_id','currency','amount','investigation_units'])},
  },async(request,reply)=>{
    const input=request.body;
    if(Number(input.amount)<=0||input.billing_mode==='subscription'&&input.currency!=='USD')throw new ApiError(400,'invalid_offer','Use a positive amount; recurring offers currently require USD');
    try{const offer=await db.transaction(async client=>{
      const row=(await client.query(`INSERT INTO billing_offers (environment,offer_key,display_name,billing_mode,provider_product_id,currency,amount,investigation_units,is_enabled)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[environment,input.offer_key,input.display_name,input.billing_mode,input.provider_product_id,input.currency,input.amount,input.investigation_units,input.is_enabled??false])).rows[0]!;
      await audit(client,request,'billing.offers.create','billing_offer',row.offer_id,null,row);return row;
    });return reply.code(201).send({offer});}
    catch(error){if((error as {code?:string}).code==='23505')throw new ApiError(409,'offer_exists','Offer key or product mapping already exists');throw error;}
  });
  app.patch<{Params:{id:string};Body:{display_name?:string;is_enabled?:boolean}}>('/v1/admin/billing/offers/:id',{
    onRequest:superadmin,schema:{params:params('id'),body:{...body({display_name:text(120),is_enabled:{type:'boolean'}}),minProperties:1}},
  },async request=>db.transaction(async client=>{
    const before=(await client.query('SELECT * FROM billing_offers WHERE offer_id=$1 AND environment=$2 FOR UPDATE',[request.params.id,environment])).rows[0];
    if(!before)throw new ApiError(404,'offer_not_found','Offer was not found');
    const after=(await client.query('UPDATE billing_offers SET display_name=$2,is_enabled=$3 WHERE offer_id=$1 RETURNING *',[request.params.id,request.body.display_name??before.display_name,request.body.is_enabled??before.is_enabled])).rows[0]!;
    await audit(client,request,'billing.offers.update','billing_offer',request.params.id,before,after);return {offer:after};
  }));
  app.get<{Querystring:{limit?:number;offset?:number}}>('/v1/admin/billing/events',{
    onRequest:superadmin,schema:{querystring:pagination},
  },async request=>({events:(await db.query(`SELECT provider_event_id,event_type,processing_status,processing_error_code,received_at,processed_at
    FROM billing_webhook_events WHERE environment=$1 ORDER BY received_at DESC LIMIT $2 OFFSET $3`,[environment,request.query.limit??20,request.query.offset??0])).rows}));
  app.get<{Querystring:{limit?:number;offset?:number}}>('/v1/admin/billing/grants',{
    onRequest:superadmin,schema:{querystring:pagination},
  },async request=>({grants:(await db.query(`SELECT * FROM billing_grants WHERE environment=$1 ORDER BY created_at DESC,billing_grant_id LIMIT $2 OFFSET $3`,
    [environment,request.query.limit??20,request.query.offset??0])).rows}));
  app.post<{Params:{id:string};Body:{note:string}}>('/v1/admin/billing/grants/:id/revoke',{
    onRequest:superadmin,schema:{params:params('id'),body:body({note:text(2000)},['note'])},
  },async request=>db.transaction(async client=>{
    const before=(await client.query('SELECT * FROM billing_grants WHERE billing_grant_id=$1 AND environment=$2 FOR UPDATE',[request.params.id,environment])).rows[0];
    if(!before)throw new ApiError(404,'grant_not_found','Billing grant was not found');
    if(before.revoked_at)return {grant:before};
    const after=(await client.query('UPDATE billing_grants SET revoked_at=now() WHERE billing_grant_id=$1 RETURNING *',[request.params.id])).rows[0]!;
    await audit(client,request,'billing.grants.revoke','billing_grant',request.params.id,before,{...after,note:request.body.note});
    return {grant:after};
  }));

  app.register(async webhooks=>{
    webhooks.removeContentTypeParser('application/json');
    webhooks.addContentTypeParser('application/json',{parseAs:'buffer'},(_request,raw,done)=>done(null,raw));
    webhooks.post<{Body:Buffer}>('/v1/webhooks/bachs',{bodyLimit:64*1024},async(request,reply)=>{
      const {settings}=available();const event=verifyWebhook(request.body,request.headers,settings.webhookSecret);
      if(event.organization_id!==settings.organizationId)throw new ApiError(400,'invalid_webhook','Invalid payment organization');
      if(typeof event.id!=='string'||!/^evt_[a-zA-Z0-9_-]{1,200}$/.test(event.id)||typeof event.type!=='string'||event.type.length>100||
        !event.data||typeof event.data!=='object'||Array.isArray(event.data))throw new ApiError(400,'invalid_webhook','Invalid payment event');
      let created:string;
      try{created=date(event.created_at);}catch{throw new ApiError(400,'invalid_webhook','Invalid payment event timestamp');}
      const facts=eventFacts(event.data);
      await db.query(`INSERT INTO billing_webhook_events (environment,provider_event_id,organization_id,event_type,provider_created_at,payload_sha256,event_data)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT (environment,provider_event_id) DO NOTHING`,
      [environment,event.id,settings.organizationId,event.type,created,createHash('sha256').update(request.body).digest('hex'),JSON.stringify(facts)]);
      return reply.code(202).send({received:true});
    });
  });

  let timer:NodeJS.Timeout|undefined;let stopping=false;let pending:Promise<void>|undefined;
  const tick=()=>{
    if(stopping||pending||!provider)return;
    pending=(async()=>{for(let i=0;i<10&&!stopping;i++)if(!await processBillingEvent(db,provider,environment))break;})()
      .catch(()=>{app.log.error('Billing event processing failed');}).finally(()=>{pending=undefined;});
  };
  app.addHook('onReady',async()=>{if(config.billingEnabled){await billingReadiness(db);timer=setInterval(tick,5000);timer.unref();tick();}});
  app.addHook('preClose',async()=>{stopping=true;if(timer)clearInterval(timer);await pending;});
}
