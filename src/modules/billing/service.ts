import { createHash } from 'node:crypto';
import type { Database, SqlExecutor } from '../../database/index.js';
import type { AppConfig } from '../../config.js';
import { ApiError } from '../../errors.js';
import { providerUrl } from '../../adapters/bachs.js';
import type { BillingProvider, Checkout, Json, Offer } from './types.js';
import { currencyAmount, date, money, sameMoney } from './verification.js';

export const billingTables = ['billing_offers','billing_checkouts','billing_subscriptions','billing_webhook_events','billing_grants','billing_usage'];
export async function billingReadiness(db:SqlExecutor){
  await db.query(`SELECT o.offer_id,c.billing_checkout_id,s.billing_subscription_id,e.provider_event_id,g.units_used,u.investigation_id
    FROM billing_offers o,billing_checkouts c,billing_subscriptions s,billing_webhook_events e,billing_grants g,billing_usage u LIMIT 0`);
}
const mismatch=()=>new ApiError(409,'billing_mismatch','Payment details do not match the saved offer');
export const checkoutDto=(row:Checkout)=>({billing_checkout_id:row.billing_checkout_id,offer_key:row.offer_snapshot.offer_key,
  billing_mode:row.offer_snapshot.billing_mode,amount:row.offer_snapshot.amount,currency:row.offer_snapshot.currency,
  investigation_units:row.offer_snapshot.investigation_units,status:row.status,checkout_url:row.checkout_url,
  provider_checkout_id:row.provider_checkout_id,expires_at:row.expires_at,paid_at:row.paid_at,created_at:row.created_at});

export function validateCheckout(row:Checkout,value:Json){
  const offer=row.offer_snapshot;const products=value.products;
  if(value.checkout_id!==row.provider_checkout_id||value.reference!==row.billing_checkout_id||value.currency!==offer.currency||
    !sameMoney(value.amount,offer.amount)||!Array.isArray(products)||products.length!==1||
    products[0].product_id!==offer.provider_product_id||products[0].quantity!==1||products[0].currency!==offer.currency||
    !sameMoney(products[0].unit_amount,offer.amount)||Boolean(value.recurring)!==(offer.billing_mode==='subscription'))throw mismatch();
}

export async function newCheckout(db:Database,provider:BillingProvider,config:NonNullable<AppConfig['bachs']>,user:{users_id:string;email:string;display_name:string},offerKey:string,requestKey:string){
  // Persist identity before contacting the provider. A response lost after a
  // provider write reuses the same idempotency key AND globally unique reference.
  const fingerprint=createHash('sha256').update(offerKey).digest('hex');
  let row=(await db.query<Checkout>('SELECT * FROM billing_checkouts WHERE users_id=$1 AND environment=$2 AND request_key=$3',[user.users_id,config.environment,requestKey])).rows[0];
  if(!row){
    const offer=(await db.query<Offer>('SELECT * FROM billing_offers WHERE environment=$1 AND offer_key=$2 AND is_enabled',[config.environment,offerKey])).rows[0];
    if(!offer)throw new ApiError(404,'offer_not_found','Billing offer was not found');
    await db.query(`INSERT INTO billing_checkouts (users_id,environment,offer_id,request_key,request_fingerprint,offer_snapshot)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT (users_id,environment,request_key) DO NOTHING`,
    [user.users_id,config.environment,offer.offer_id,requestKey,fingerprint,JSON.stringify(offer)]);
  }
  return db.transaction(async client=>{
    row=(await client.query<Checkout>('SELECT * FROM billing_checkouts WHERE users_id=$1 AND environment=$2 AND request_key=$3 FOR UPDATE',[user.users_id,config.environment,requestKey])).rows[0]!;
    if(row.offer_snapshot.offer_key!==offerKey)throw new ApiError(409,'idempotency_conflict','This request key was used for another offer');
    if(row.provider_checkout_id)return checkoutDto(row);
    if(Date.now()-new Date(row.created_at).getTime()>15*60*1000)throw new ApiError(409,'checkout_requires_reconciliation','The checkout needs reconciliation before another attempt');
    const offer=row.offer_snapshot;
    const created=await provider.createCheckout({product_cart:[{product_id:offer.provider_product_id,quantity:1,
      pricing:{price_type:'fixed',amount:currencyAmount(offer.amount)}}],billing_currency:offer.currency,
      customer:{email:user.email,name:user.display_name},reference:row.billing_checkout_id,
      metadata:{billing_checkout_id:row.billing_checkout_id},success_url:config.successUrl,cancel_url:config.cancelUrl},row.billing_checkout_id);
    if(typeof created.checkout_id!=='string'||!/^chk_[a-zA-Z0-9_-]{1,200}$/.test(created.checkout_id)||created.status!=='open')throw mismatch();
    const url=providerUrl(created.checkout_url,config.environment,'checkout');
    const expected={...row,provider_checkout_id:created.checkout_id};
    validateCheckout(expected,await provider.checkout(created.checkout_id));
    const saved=(await client.query<Checkout>(`UPDATE billing_checkouts SET provider_checkout_id=$2,checkout_url=$3,status='open',expires_at=$4
      WHERE billing_checkout_id=$1 RETURNING *`,[row.billing_checkout_id,created.checkout_id,url,date(created.expires_at)])).rows[0]!;
    return checkoutDto(saved);
  });
}

export async function consumeUnit(client:SqlExecutor,userId:string,investigationId:string,environment:string){
  // Compatible with the FK key-share locks taken by concurrent investigation
  // inserts; FOR UPDATE here could deadlock after both inserts succeeded.
  await client.query('SELECT users_id FROM users WHERE users_id=$1 FOR NO KEY UPDATE',[userId]);
  const grant=(await client.query(`SELECT g.billing_grant_id FROM billing_grants g
    WHERE g.users_id=$1 AND g.environment=$2 AND g.revoked_at IS NULL AND g.units_used<g.units_granted
    AND g.valid_from<=now() AND (g.expires_at IS NULL OR g.expires_at>now())
    AND (g.billing_subscription_id IS NULL OR EXISTS (SELECT 1 FROM billing_subscriptions s
      WHERE s.billing_subscription_id=g.billing_subscription_id AND s.provider_status NOT IN ('unpaid','paused')))
    ORDER BY g.expires_at ASC NULLS LAST,g.created_at,g.billing_grant_id LIMIT 1 FOR UPDATE OF g`,[userId,environment])).rows[0];
  if(!grant)throw new ApiError(402,'payment_required','Purchase an investigation or a subscription with available units');
  await client.query('UPDATE billing_grants SET units_used=units_used+1 WHERE billing_grant_id=$1',[grant.billing_grant_id]);
  await client.query('INSERT INTO billing_usage (investigation_id,users_id,billing_grant_id) VALUES ($1,$2,$3)',[investigationId,userId,grant.billing_grant_id]);
}

// Only signed events may call these functions. Browser reads never fulfil orders.
async function syncCheckout(client:SqlExecutor,provider:BillingProvider,checkoutId:string,environment:string){
  let row=(await client.query<Checkout>('SELECT * FROM billing_checkouts WHERE environment=$1 AND provider_checkout_id=$2 FOR UPDATE',[environment,checkoutId])).rows[0];
  const value=await provider.checkout(checkoutId);
  if(!row&&typeof value.reference==='string'&&/^[a-f0-9-]{36}$/i.test(value.reference)){
    row=(await client.query<Checkout>('SELECT * FROM billing_checkouts WHERE environment=$1 AND billing_checkout_id=$2 FOR UPDATE',[environment,value.reference])).rows[0];
    if(row&&row.provider_checkout_id===null){
      validateCheckout({...row,provider_checkout_id:checkoutId},value);
      await client.query('UPDATE billing_checkouts SET provider_checkout_id=$2 WHERE billing_checkout_id=$1',[row.billing_checkout_id,checkoutId]);
      row={...row,provider_checkout_id:checkoutId};
    }
  }
  if(!row)throw new ApiError(409,'checkout_not_mapped','Checkout mapping is not available yet');
  validateCheckout(row,value);
  if(value.status==='completed'&&value.payment_status==='succeeded'){
    if(!value.charge||value.charge.status!=='succeeded'||value.charge.currency!==row.offer_snapshot.currency||
      !sameMoney(value.charge.amount,row.offer_snapshot.amount)||
      value.charge.amount_remaining!=null&&money(value.charge.amount_remaining)!==0n||
      value.charge.amount_paid!=null&&money(value.charge.amount_paid)<money(row.offer_snapshot.amount))throw mismatch();
    const customerId=value.customer?.id;
    if(typeof customerId!=='string'||!/^cust_[a-zA-Z0-9_-]{1,200}$/.test(customerId))throw mismatch();
    await client.query(`UPDATE billing_checkouts SET status=CASE WHEN status='refunded' THEN status ELSE 'paid' END,
      paid_at=COALESCE(paid_at,now()),provider_customer_id=$2 WHERE billing_checkout_id=$1`,[row.billing_checkout_id,customerId]);
    if(row.offer_snapshot.billing_mode==='one_time'&&row.status!=='refunded'){
      await client.query(`INSERT INTO billing_grants (users_id,environment,billing_checkout_id,source_type,provider_source_id,units_granted,valid_from)
        VALUES ($1,$2,$3,'checkout',$4,$5,now()) ON CONFLICT (environment,source_type,provider_source_id) DO NOTHING`,
      [row.users_id,environment,row.billing_checkout_id,checkoutId,row.offer_snapshot.investigation_units]);
    }
  }else if(['expired','cancelled'].includes(value.status)){
    await client.query("UPDATE billing_checkouts SET status='expired' WHERE billing_checkout_id=$1 AND status NOT IN ('paid','refunded')",[row.billing_checkout_id]);
  }else if(value.status==='completed')throw mismatch();
  return {row,value};
}

async function syncSubscription(client:SqlExecutor,provider:BillingProvider,id:string,environment:string,eventTime:string){
  const value=await provider.subscription(id);
  if(value.id!==id||typeof value.metadata?.billing_checkout_id!=='string')throw mismatch();
  const mapped=(await client.query<Checkout>('SELECT * FROM billing_checkouts WHERE environment=$1 AND billing_checkout_id=$2 FOR UPDATE',[environment,value.metadata.billing_checkout_id])).rows[0];
  if(!mapped?.provider_checkout_id||mapped.offer_snapshot.billing_mode!=='subscription')throw mismatch();
  const {value:checkout}=await syncCheckout(client,provider,mapped.provider_checkout_id,environment);
  const offer=mapped.offer_snapshot;const customerId=value.customer?.customer_id;
  if(value.product?.id!==offer.provider_product_id||value.currency!==offer.currency||!sameMoney(value.amount,offer.amount)||
    value.quantity!==1||typeof customerId!=='string'||customerId!==checkout.customer?.id||
    !['trialing','active','past_due','unpaid','canceled','paused'].includes(value.status))throw mismatch();
  const start=date(value.current_period_start),end=date(value.current_period_end);
  if(Date.parse(end)<=Date.parse(start))throw mismatch();
  // One subscription identity can never be rebound to a different account.
  const existing=(await client.query('SELECT users_id,offer_id FROM billing_subscriptions WHERE environment=$1 AND provider_subscription_id=$2',[environment,id])).rows[0];
  if(existing&&(existing.users_id!==mapped.users_id||existing.offer_id!==mapped.offer_id))throw mismatch();
  const subscription=(await client.query(`INSERT INTO billing_subscriptions
    (users_id,environment,offer_id,provider_subscription_id,provider_customer_id,provider_status,current_period_start,current_period_end,cancel_at_period_end,provider_updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (environment,provider_subscription_id) DO UPDATE SET provider_status=EXCLUDED.provider_status,
    current_period_start=EXCLUDED.current_period_start,current_period_end=EXCLUDED.current_period_end,
    cancel_at_period_end=EXCLUDED.cancel_at_period_end,provider_updated_at=EXCLUDED.provider_updated_at
    WHERE billing_subscriptions.provider_updated_at<=EXCLUDED.provider_updated_at RETURNING *`,
  [mapped.users_id,environment,mapped.offer_id,id,customerId,value.status,start,end,Boolean(value.cancel_at_period_end),eventTime])).rows[0]??
    (await client.query('SELECT * FROM billing_subscriptions WHERE environment=$1 AND provider_subscription_id=$2',[environment,id])).rows[0]!;
  return {subscription,offer,value};
}

export function eventFacts(data:Json):Json {
  const facts:Json={};
  for(const key of ['checkout_id','subscription_id','invoice_id','charge_id','status','currency','amount','total','amount_paid','amount_remaining','period_start','period_end']){
    if(typeof data[key]==='string'&&data[key].length<200)facts[key]=data[key];
  }
  if(typeof data.subscription?.subscription_id==='string')facts.subscription_id=data.subscription.subscription_id;
  if(typeof data.customer?.customer_id==='string')facts.customer_id=data.customer.customer_id;
  return facts;
}

export async function processBillingEvent(db:Database,provider:BillingProvider,environment:string):Promise<boolean>{
  let eventId:string|undefined;
  try{return await db.transaction(async client=>{
    const event=(await client.query(`SELECT * FROM billing_webhook_events WHERE environment=$1 AND processing_status='pending'
      ORDER BY received_at,provider_event_id LIMIT 1 FOR UPDATE SKIP LOCKED`,[environment])).rows[0];
    if(!event)return false;eventId=event.provider_event_id;const facts=event.event_data as Json;let handled=true;
    if(['checkout.completed','checkout.expired','collection.succeeded','collection.failed','collection.underpaid'].includes(event.event_type)){
      if(typeof facts.checkout_id!=='string')handled=false;else await syncCheckout(client,provider,facts.checkout_id,environment);
    }else if(event.event_type.startsWith('customer.subscription.')){
      if(typeof facts.subscription_id!=='string')throw mismatch();
      await syncSubscription(client,provider,facts.subscription_id,environment,new Date(event.provider_created_at).toISOString());
    }else if(event.event_type==='invoice.paid'){
      if(!facts.subscription_id)handled=false;
      else{
        const {subscription,offer}=await syncSubscription(client,provider,facts.subscription_id,environment,new Date(event.provider_created_at).toISOString());
        if(!/^inv_[a-zA-Z0-9_-]{1,200}$/.test(facts.invoice_id??'')||facts.customer_id!==subscription.provider_customer_id||facts.status!=='paid'||
          facts.currency!==offer.currency||!sameMoney(facts.total,offer.amount)||!sameMoney(facts.amount_paid,offer.amount)||money(facts.amount_remaining)!==0n)throw mismatch();
        const start=date(facts.period_start),end=date(facts.period_end);if(Date.parse(end)<=Date.parse(start))throw mismatch();
        const period=await client.query(`SELECT 1 FROM billing_grants WHERE billing_subscription_id=$1 AND valid_from=$2 AND expires_at=$3`,
          [subscription.billing_subscription_id,start,end]);
        if(period.rowCount){
          await client.query(`UPDATE billing_webhook_events SET processing_status='processed',processed_at=now(),processing_error_code=NULL
            WHERE environment=$1 AND provider_event_id=$2`,[environment,eventId]);
          return true;
        }
        await client.query(`INSERT INTO billing_grants (users_id,environment,billing_subscription_id,source_type,provider_source_id,units_granted,valid_from,expires_at)
          VALUES ($1,$2,$3,'invoice',$4,$5,$6,$7) ON CONFLICT (environment,source_type,provider_source_id) DO NOTHING`,
        [subscription.users_id,environment,subscription.billing_subscription_id,facts.invoice_id,offer.investigation_units,start,end]);
      }
    }else if(event.event_type.startsWith('refund.')||event.event_type.startsWith('dispute.')){
      // Keep financial reversals visible for reconciliation; never silently ignore.
      throw new ApiError(409,'billing_reversal_review_required','Payment reversal requires reconciliation');
    }else handled=false;
    await client.query(`UPDATE billing_webhook_events SET processing_status=$3,processed_at=now(),processing_error_code=NULL
      WHERE environment=$1 AND provider_event_id=$2`,[environment,eventId,handled?'processed':'ignored']);
    return true;
  });}catch(error){
    if(!eventId)throw error;
    await db.query(`UPDATE billing_webhook_events SET processing_error_code=$3,received_at=now()
      WHERE environment=$1 AND provider_event_id=$2 AND processing_status='pending'`,
    [environment,eventId,error instanceof ApiError?error.code:'billing_processing_failed']);
    return false;
  }
}
