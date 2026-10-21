import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHmac, randomUUID } from 'node:crypto';
import { loadConfig } from '../src/config.js';
import { testDatabase } from './support/database.js';
import { buildTestApp, completeRegistration } from './support/auth.js';
import { processBillingEvent } from '../src/modules/billing/service.js';
import { verifyWebhook, currencyAmount } from '../src/modules/billing/verification.js';
import { bachsProvider, providerUrl } from '../src/adapters/bachs.js';
import type { BillingProvider, Json } from '../src/modules/billing/types.js';

const env={NODE_ENV:'test',LOG_LEVEL:'silent',DATABASE_URL:'postgres://unused:unused@localhost/test',JWT_SECRET:'billing-test-secret-at-least-32-bytes-long'};
const billingEnv={...env,BILLING_ENABLED:'true',BACHS_ENVIRONMENT:'sandbox',BACHS_API_KEY:'sk_sandbox_fixture',BACHS_WEBHOOK_SECRET:'webhook-fixture-secret-long-value',
  BACHS_ORGANIZATION_ID:'acct_fixture',BACHS_SUCCESS_URL:'https://app.example.com/billing/return',BACHS_CANCEL_URL:'https://app.example.com/billing/cancel'};
const config=loadConfig(billingEnv);
const signature=(raw:string,t=String(Math.floor(Date.now()/1000)))=>({ 'x-bachs-signature-v2':`t=${t},v1=${createHmac('sha256',billingEnv.BACHS_WEBHOOK_SECRET).update(t+'.'+raw).digest('hex')}` });

test('billing configuration defaults off and refuses environment/key/URL mismatches',()=>{
  assert.equal(loadConfig(env).billingEnabled,false);
  assert.throws(()=>loadConfig({...env,BILLING_ENABLED:'true'}),/Bachs/);
  assert.throws(()=>loadConfig({...billingEnv,BACHS_ENVIRONMENT:'production'}),/does not match/);
  assert.throws(()=>loadConfig({...billingEnv,BACHS_SUCCESS_URL:'http://localhost:5173/return'}),/HTTPS/);
  assert.throws(()=>loadConfig({...billingEnv,BACHS_WEBHOOK_SECRET:''}),/Bachs/);
  assert.equal(currencyAmount('10.000000'),'10.00');
  assert.throws(()=>currencyAmount('10.000001'));
});

test('Bachs signatures verify raw bytes, all V2 signatures, timestamps and legacy headers',()=>{
  const raw='{ "id": "evt_example", "type": "example" }';const headers=signature(raw);
  assert.equal(verifyWebhook(Buffer.from(raw),headers,billingEnv.BACHS_WEBHOOK_SECRET).id,'evt_example');
  assert.equal(verifyWebhook(Buffer.from(raw),{'x-bachs-signature-v2':headers['x-bachs-signature-v2']!.replace(',v1=',`,v1=${'0'.repeat(64)},v1=`)},billingEnv.BACHS_WEBHOOK_SECRET).id,'evt_example');
  for(const bad of [Buffer.from(raw+' '),Buffer.from(JSON.stringify(JSON.parse(raw)))])assert.throws(()=>verifyWebhook(bad,headers,billingEnv.BACHS_WEBHOOK_SECRET));
  for(const age of [-600,600])assert.throws(()=>verifyWebhook(Buffer.from(raw),signature(raw,String(Math.floor(Date.now()/1000)+age)),billingEnv.BACHS_WEBHOOK_SECRET));
  assert.throws(()=>verifyWebhook(Buffer.from(raw),{'x-bachs-signature-v2':'t=NaN,v1=bad'},billingEnv.BACHS_WEBHOOK_SECRET));
  const [t,s]=headers['x-bachs-signature-v2']!.split(',');
  assert.equal(verifyWebhook(Buffer.from(raw),{'x-bachs-timestamp':t!.slice(2),'x-bachs-signature':s!.slice(3)},billingEnv.BACHS_WEBHOOK_SECRET).id,'evt_example');
});

test('Bachs adapter uses fixed sandbox origin, bounded calls and safe URLs/errors',async()=>{
  const calls:{url:string;options:RequestInit}[]=[];
  const provider=bachsProvider(config.bachs!,async(url,options)=>{calls.push({url:String(url),options:options!});return new Response('{"checkout_id":"chk_test"}');});
  await provider.createCheckout({reference:'example'},'stable-key');
  assert.equal(calls[0]!.url,'https://sandbox-api.bachs.io/v1/checkout-sessions');
  assert.equal((calls[0]!.options.headers as Json)['Idempotency-Key'],'stable-key');
  assert.equal(calls[0]!.options.redirect,'error');assert.ok(calls[0]!.options.signal);
  assert.throws(()=>provider.checkout('../admin'));
  assert.throws(()=>providerUrl('https://attacker.example/c/x','sandbox','checkout'));
  assert.throws(()=>providerUrl('https://sandbox-checkout.bachs.io/c/x','production','checkout'));
  const failed=bachsProvider(config.bachs!,async()=>new Response('SECRET_PROVIDER_DETAILS',{status:500}));
  await assert.rejects(failed.checkout('chk_test'),error=>!String(error).includes('SECRET_PROVIDER_DETAILS'));
});

test('billing checkout, verified inbox, one-time and subscription allowances',async t=>{
  const {db,postgres}=await testDatabase();
  await postgres.exec(await readFile(new URL('../db/migrations/003_billing.sql',import.meta.url),'utf8'));
  const checkouts=new Map<string,Json>();const subscriptions=new Map<string,Json>();let creates=0;
  const provider:BillingProvider={
    async createCheckout(input){creates++;const id='chk_'+creates;checkouts.set(id,{...input,checkout_id:id,status:'open',payment_status:'requires_payment_method',amount:input.product_cart[0].pricing.amount,
      currency:input.billing_currency,products:[{...input.product_cart[0],unit_amount:input.product_cart[0].pricing.amount,currency:input.billing_currency}],
      recurring:input.product_cart[0].product_id==='prod_recurring'?{interval:'month',interval_count:1}:null,customer:{id:'cust_'+creates}});
      return {checkout_id:id,checkout_url:'https://sandbox-checkout.bachs.io/c/'+id,status:'open',expires_at:new Date(Date.now()+3600000).toISOString()};},
    async checkout(id){return checkouts.get(id)!;},async subscription(id){return subscriptions.get(id)!;},
    async portal(id){return {url:'https://portal.bachs.io/s/'+id};},
  };
  const app=buildTestApp(config,db,{billing:provider});
  const token=(await completeRegistration(app,{email:'billing@example.com',display_name:'Buyer',password:'BillingPassword123!'})).json().access_token;
  const other=(await completeRegistration(app,{email:'other@example.com',display_name:'Other',password:'BillingPassword123!'})).json().access_token;
  const headers={authorization:`Bearer ${token}`};const otherHeaders={authorization:`Bearer ${other}`};
  const userId=(await app.inject({url:'/v1/auth/me',headers})).json().user.users_id;
  let oneId:string;let recurringId:string;
  const purchase=async(offer_key:string,key=randomUUID())=>app.inject({method:'POST',url:'/v1/billing/checkouts',headers,payload:{offer_key,request_key:key}});
  const event=async(type:string,data:Json,id='evt_'+randomUUID().replaceAll('-',''))=>{
    const payload=JSON.stringify({id,type,organization_id:billingEnv.BACHS_ORGANIZATION_ID,created_at:new Date().toISOString(),data});
    const res=await app.inject({method:'POST',url:'/v1/webhooks/bachs',headers:{...signature(payload),'content-type':'application/json'},payload});
    assert.equal(res.statusCode,202,res.body);return id;
  };
  const process=()=>processBillingEvent(db,provider,'sandbox');
  try{
    await t.test('superadmin owns immutable offer configuration and no prices are seeded',async()=>{
      assert.deepEqual((await app.inject('/v1/billing/offers')).json().offers,[]);
      const input={offer_key:'single',display_name:'One investigation',billing_mode:'one_time',provider_product_id:'prod_single',currency:'USD',amount:'10.00',investigation_units:1,is_enabled:true};
      assert.equal((await app.inject({method:'POST',url:'/v1/admin/billing/offers',headers,payload:input})).statusCode,403);
      await db.query("INSERT INTO user_roles (users_id,role_id) SELECT $1,role_id FROM roles WHERE role_key='superadmin'",[userId]);
      const created=await app.inject({method:'POST',url:'/v1/admin/billing/offers',headers,payload:input});assert.equal(created.statusCode,201,created.body);oneId=created.json().offer.offer_id;
      const recurring=await app.inject({method:'POST',url:'/v1/admin/billing/offers',headers,payload:{...input,offer_key:'monthly',billing_mode:'subscription',provider_product_id:'prod_recurring',investigation_units:3}});
      assert.equal(recurring.statusCode,201,recurring.body);recurringId=recurring.json().offer.offer_id;
      assert.equal((await app.inject({method:'PATCH',url:'/v1/admin/billing/offers/'+oneId,headers,payload:{amount:'1.00'}})).statusCode,400);
    });
    let checkout:Json;
    await t.test('owned checkout is idempotent, has server pricing and does not grant from redirects or reads',async()=>{
      const key=randomUUID();const created=await purchase('single',key);assert.equal(created.statusCode,201,created.body);checkout=created.json().checkout;
      const again=await purchase('single',key);assert.equal(again.statusCode,201,again.body);assert.equal(creates,1);assert.equal(again.json().checkout.billing_checkout_id,checkout.billing_checkout_id);
      assert.equal((await purchase('monthly',key)).statusCode,409);
      assert.equal((await app.inject({url:'/v1/billing/checkouts/'+checkout.billing_checkout_id,headers:otherHeaders})).statusCode,404);
      assert.equal((await app.inject({method:'POST',url:'/v1/billing/checkouts',headers,payload:{offer_key:'single',request_key:randomUUID(),amount:'0.01'}})).statusCode,400);
      assert.equal((await app.inject({url:'/v1/billing/me',headers})).json().available_units,0);
      const denied=await app.inject({method:'POST',url:'/v1/investigations',headers,payload:{investigation_type:'general_research',user_prompt:'Test'}});
      assert.equal(denied.statusCode,402,denied.body);assert.equal((await db.query('SELECT count(*)::int AS n FROM investigations')).rows[0]!.n,0);
    });
    await t.test('verified events are persisted without customer PII and deduplicated across event types',async()=>{
      const id=checkout!.provider_checkout_id;const value=checkouts.get(id)!;value.status='completed';value.payment_status='succeeded';value.charge={status:'succeeded',amount:'10.00',currency:'USD'};
      const eid=await event('checkout.completed',{checkout_id:id,customer:{email:'DO_NOT_STORE',customer_id:value.customer.id}});
      await event('checkout.completed',{checkout_id:id},eid);await event('collection.succeeded',{checkout_id:id});
      for(let i=0;i<3;i++)await process();
      assert.equal((await app.inject({url:'/v1/billing/me',headers})).json().available_units,1);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_grants')).rows[0]!.n,1);
      assert.ok(!JSON.stringify((await db.query('SELECT * FROM billing_webhook_events')).rows).includes('DO_NOT_STORE'));
      const raw=JSON.stringify({id:'evt_wrong',type:'checkout.completed',organization_id:'acct_wrong',created_at:new Date().toISOString(),data:{checkout_id:id}});
      assert.equal((await app.inject({method:'POST',url:'/v1/webhooks/bachs',headers:{...signature(raw),'content-type':'application/json'},payload:raw})).statusCode,400);
    });
    await t.test('investigation creation consumes once and rolls back failed creates',async()=>{
      const created=await app.inject({method:'POST',url:'/v1/investigations',headers,payload:{investigation_type:'general_research',user_prompt:'Test'}});
      assert.equal(created.statusCode,202,created.body);const id=created.json().investigation.investigation_id;
      assert.equal((await app.inject({url:'/v1/billing/me',headers})).json().available_units,0);
      await db.query("UPDATE investigations SET status='failed' WHERE investigation_id=$1",[id]);
      assert.equal((await app.inject({method:'POST',url:`/v1/investigations/${id}/retry`,headers})).statusCode,202);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_usage')).rows[0]!.n,1);
    });
    await t.test('lost checkout mapping recovers and a grant insert failure rolls state back for durable retry',async()=>{
      const created=await purchase('single');assert.equal(created.statusCode,201,created.body);const saved=created.json().checkout;
      const value=checkouts.get(saved.provider_checkout_id)!;value.status='completed';value.payment_status='succeeded';value.charge={status:'succeeded',amount:'10.00',currency:'USD'};
      await db.query("UPDATE billing_checkouts SET provider_checkout_id=NULL,checkout_url=NULL,status='creating' WHERE billing_checkout_id=$1",[saved.billing_checkout_id]);
      await postgres.exec(`CREATE FUNCTION reject_billing_grant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test grant failure'; END; $$;
        CREATE TRIGGER reject_billing_grant BEFORE INSERT ON billing_grants FOR EACH ROW EXECUTE FUNCTION reject_billing_grant();`);
      const eid=await event('checkout.completed',{checkout_id:saved.provider_checkout_id});await process();
      assert.equal((await db.query('SELECT status FROM billing_checkouts WHERE billing_checkout_id=$1',[saved.billing_checkout_id])).rows[0]!.status,'creating');
      assert.equal((await db.query('SELECT processing_status FROM billing_webhook_events WHERE provider_event_id=$1',[eid])).rows[0]!.processing_status,'pending');
      await postgres.exec('DROP TRIGGER reject_billing_grant ON billing_grants; DROP FUNCTION reject_billing_grant();');
      await process();assert.equal((await app.inject({url:'/v1/billing/me',headers})).json().available_units,1);
      assert.equal((await db.query('SELECT provider_checkout_id FROM billing_checkouts WHERE billing_checkout_id=$1',[saved.billing_checkout_id])).rows[0]!.provider_checkout_id,saved.provider_checkout_id);
      const grant=(await db.query('SELECT billing_grant_id FROM billing_grants WHERE provider_source_id=$1',[saved.provider_checkout_id])).rows[0]!.billing_grant_id;
      await app.inject({method:'POST',url:`/v1/admin/billing/grants/${grant}/revoke`,headers,payload:{note:'Clear test grant'}});
    });
    let subCheckout:Json;
    await t.test('paid invoices grant a subscription allowance once, even when invoice arrives first',async()=>{
      const res=await purchase('monthly');assert.equal(res.statusCode,201,res.body);subCheckout=res.json().checkout;
      const value=checkouts.get(subCheckout.provider_checkout_id)!;value.status='completed';value.payment_status='succeeded';value.charge={status:'succeeded',amount:'10.00',currency:'USD'};
      subscriptions.set('sub_example',{id:'sub_example',metadata:value.metadata,product:{id:'prod_recurring'},customer:{customer_id:value.customer.id},status:'active',
        amount:'10.00',currency:'USD',quantity:1,current_period_start:new Date(Date.now()-60000).toISOString(),current_period_end:new Date(Date.now()+86400000).toISOString(),cancel_at_period_end:false});
      const sub=subscriptions.get('sub_example')!;
      const invoice={invoice_id:'inv_first',subscription:{subscription_id:'sub_example'},customer:{customer_id:value.customer.id},status:'paid',currency:'USD',total:'10.00',amount_paid:'10.00',amount_remaining:'0.00',period_start:sub.current_period_start,period_end:sub.current_period_end};
      await event('invoice.paid',invoice);await process();await event('invoice.paid',invoice);await process();
      await event('invoice.paid',{...invoice,invoice_id:'inv_sameperiod'});await process();
      assert.equal((await app.inject({url:'/v1/billing/me',headers})).json().available_units,3);
      await event('customer.subscription.created',{subscription_id:'sub_example'});await process();
      assert.equal((await app.inject({url:'/v1/billing/me',headers})).json().available_units,3);
      await db.query("UPDATE billing_grants SET expires_at=now()-interval '1 second' WHERE source_type='invoice'");
      assert.equal((await app.inject({url:'/v1/billing/me',headers})).json().available_units,0);
      await db.query("UPDATE billing_grants SET expires_at=now()+interval '1 day' WHERE source_type='invoice'");
      const local=(await db.query('SELECT billing_subscription_id FROM billing_subscriptions')).rows[0]!.billing_subscription_id;
      assert.equal((await app.inject({method:'POST',url:'/v1/billing/portal',headers:otherHeaders,payload:{billing_subscription_id:local}})).statusCode,404);
      assert.equal((await app.inject({method:'POST',url:'/v1/billing/portal',headers,payload:{billing_subscription_id:local}})).statusCode,200);
    });
    await t.test('mismatched invoices remain pending without grants, expiry and revocation remove unused access',async()=>{
      const sub=subscriptions.get('sub_example')!;
      const bad=await event('invoice.paid',{invoice_id:'inv_bad',subscription:{subscription_id:'sub_example'},customer:sub.customer,status:'paid',currency:'USD',total:'1.00',amount_paid:'1.00',amount_remaining:'0.00',period_start:sub.current_period_start,period_end:sub.current_period_end});
      await process();assert.equal((await db.query('SELECT processing_status FROM billing_webhook_events WHERE provider_event_id=$1',[bad])).rows[0]!.processing_status,'pending');
      assert.equal((await app.inject({url:'/v1/billing/me',headers})).json().available_units,3);
      const grant=(await db.query("SELECT billing_grant_id FROM billing_grants WHERE source_type='invoice'")).rows[0]!.billing_grant_id;
      assert.equal((await app.inject({method:'POST',url:`/v1/admin/billing/grants/${grant}/revoke`,headers,payload:{note:'Refund review'}})).statusCode,200);
      assert.equal((await app.inject({url:'/v1/billing/me',headers})).json().available_units,0);
      assert.ok(oneId&&recurringId);
    });
  }finally{await app.close();await db.close();}
});
