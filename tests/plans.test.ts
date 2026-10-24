import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHmac,randomUUID} from 'node:crypto';
import {testDatabase} from './support/database.js';
import {buildTestApp,completeRegistration} from './support/auth.js';
import {loadConfig} from '../src/config.js';
import {processBillingEvent} from '../src/modules/billing/service.js';
import type {BillingProvider,Json} from '../src/modules/billing/types.js';

test('naira plans, featured selection and manual period passes preserve payment and access boundaries',async t=>{
 const {db,postgres}=await testDatabase();
 for(const migration of ['003_billing','008_billing_plans'])await postgres.exec(await readFile(new URL('../db/migrations/'+migration+'.sql',import.meta.url),'utf8'));
 const env={NODE_ENV:'test',LOG_LEVEL:'silent',DATABASE_URL:'postgres://unused:unused@localhost/test',JWT_SECRET:'plans-test-secret-with-enough-bytes',BILLING_ENABLED:'true',BACHS_ENVIRONMENT:'sandbox',BACHS_API_KEY:'sk_sandbox_fixture',BACHS_WEBHOOK_SECRET:'plans-webhook-fixture-secret',BACHS_ORGANIZATION_ID:'acct_fixture',BACHS_SUCCESS_URL:'https://app.example.test/billing/return',BACHS_CANCEL_URL:'https://app.example.test/billing/cancel'};
 const products=new Map<string,Json>(),byKey=new Map<string,string>(),checkouts=new Map<string,Json>();let productCount=0,checkoutCount=0;
 const provider:BillingProvider={async createProduct(input,key){let id=byKey.get(key);if(!id){id='prod_'+(++productCount);byKey.set(key,id);products.set(id,{product_id:id,...input});}return products.get(id)!;},async product(id){return products.get(id)!;},
 async createCheckout(input){const id='chk_'+(++checkoutCount);const amount=input.product_cart[0].pricing.amount;checkouts.set(id,{...input,checkout_id:id,status:'open',amount,currency:'NGN',products:[{product_id:input.product_cart[0].product_id,quantity:1,unit_amount:amount,currency:'NGN'}],recurring:null,customer:{id:'cust_fixture'}});return {checkout_id:id,status:'open',checkout_url:'https://sandbox-checkout.bachs.io/c/'+id,expires_at:new Date(Date.now()+3600000).toISOString()};},async checkout(id){return checkouts.get(id)!;},async subscription(){throw Error('No recurring subscriptions in this test');},async portal(){throw Error('No portal in this test');}};
 const app=buildTestApp(loadConfig(env),db,{billing:provider});
 const admin=(await completeRegistration(app,{display_name:'Plan admin',email:'plan-admin@example.test',password:'Plan administrator password 123!'})).json();
 const buyer=(await completeRegistration(app,{display_name:'Plan buyer',email:'plan-buyer@example.test',password:'Plan buyer password 123!'})).json();
 await db.query("INSERT INTO user_roles(users_id,role_id) SELECT $1,role_id FROM roles WHERE role_key='superadmin'",[admin.user.users_id]);
 const headers={authorization:'Bearer '+admin.access_token},buyerHeaders={authorization:'Bearer '+buyer.access_token};
 const input={plan_key:'plus',audience:'consumer',display_name:'Plus',tagline:'For regular buyers and renters',currency:'NGN',monthly_amount:'2500.00',yearly_amount:'25000.00',monthly_credits:30,yearly_credits:360,features:['Full reports with evidence','Saved checks'],is_popular:true,is_published:true};let plus:Json;
 try{
 await t.test('only superadmins create plans, prices are NGN, drafts stay private',async()=>{
 assert.equal((await app.inject({method:'POST',url:'/v1/admin/billing/plans',headers:buyerHeaders,payload:input})).statusCode,403);
 assert.equal((await app.inject({method:'POST',url:'/v1/admin/billing/plans',headers,payload:{...input,currency:'USD'}})).statusCode,400);
 const result=await app.inject({method:'POST',url:'/v1/admin/billing/plans',headers,payload:input});assert.equal(result.statusCode,201,result.body);plus=result.json().plan;
 const draft=await app.inject({method:'POST',url:'/v1/admin/billing/plans',headers,payload:{...input,plan_key:'draft',display_name:'Draft',is_popular:false,is_published:false}});assert.equal(draft.statusCode,201,draft.body);
 const catalog=(await app.inject('/v1/billing/plans')).json().plans;assert.equal(catalog.length,1);assert.equal(catalog[0].currency,'NGN');assert.equal(Number(catalog[0].monthly_amount),2500);assert.equal(catalog[0].monthly_available,false);
 });
 await t.test('admin featured choice is exclusive and stale edits are rejected',async()=>{
 const pro=await app.inject({method:'POST',url:'/v1/admin/billing/plans',headers,payload:{...input,plan_key:'pro',display_name:'Pro'}});assert.equal(pro.statusCode,201,pro.body);
 const catalog=(await app.inject('/v1/billing/plans')).json().plans;assert.deepEqual(catalog.filter((p:Json)=>p.is_popular).map((p:Json)=>p.plan_key),['pro']);
 assert.equal((await app.inject({method:'PUT',url:'/v1/admin/billing/plans/'+plus.plan_id,headers,payload:{...input,revision:plus.revision}})).statusCode,409);
 plus=catalog.find((p:Json)=>p.plan_key==='plus');const updated=await app.inject({method:'PUT',url:'/v1/admin/billing/plans/'+plus.plan_id,headers,payload:{...input,revision:plus.revision}});assert.equal(updated.statusCode,200,updated.body);plus=updated.json().plan;
 });
 await t.test('checkout needs explicit manual-renewal acknowledgement and creates NGN one-time offers',async()=>{
 assert.equal((await app.inject({method:'POST',url:'/v1/admin/billing/plans/'+plus.plan_id+'/enable-checkout',headers,payload:{acknowledge_manual_renewal:false}})).statusCode,400);
 const result=await app.inject({method:'POST',url:'/v1/admin/billing/plans/'+plus.plan_id+'/enable-checkout',headers,payload:{acknowledge_manual_renewal:true}});assert.equal(result.statusCode,200,result.body);assert.equal(result.json().manual_renewal,true);
 const again=await app.inject({method:'POST',url:'/v1/admin/billing/plans/'+plus.plan_id+'/enable-checkout',headers,payload:{acknowledge_manual_renewal:true}});assert.equal(again.statusCode,200,again.body);assert.equal(productCount,2);
 const offers=(await db.query('SELECT * FROM billing_offers WHERE plan_id=$1',[plus.plan_id])).rows;assert.equal(offers.length,2);for(const offer of offers){assert.equal(offer.currency,'NGN');assert.equal(offer.billing_mode,'one_time');assert.ok([30,365].includes(offer.validity_days));}
 });
 await t.test('verified payment grants the exact period allowance once, expiring after 30 or 365 days',async()=>{
 const plan=(await app.inject('/v1/billing/plans')).json().plans.find((p:Json)=>p.plan_key==='plus');
 for(const [period,days,units] of [['monthly',30,30],['yearly',365,360]] as const){
 const started=await app.inject({method:'POST',url:'/v1/billing/checkouts',headers:buyerHeaders,payload:{offer_key:plan[period+'_offer_key'],request_key:randomUUID()}});assert.equal(started.statusCode,201,started.body);const saved=started.json().checkout;
 const value=checkouts.get(saved.provider_checkout_id)!;value.status='completed';value.payment_status='succeeded';value.charge={status:'succeeded',currency:'NGN',amount:value.amount};
 const raw=JSON.stringify({id:'evt_'+period,type:'checkout.completed',organization_id:'acct_fixture',created_at:new Date().toISOString(),data:{checkout_id:saved.provider_checkout_id}});const timestamp=String(Math.floor(Date.now()/1000));const signature=createHmac('sha256',env.BACHS_WEBHOOK_SECRET).update(timestamp+'.'+raw).digest('hex');
 const event={method:'POST' as const,url:'/v1/webhooks/bachs',headers:{'content-type':'application/json','x-bachs-signature-v2':'t='+timestamp+',v1='+signature},payload:raw};
 assert.equal((await app.inject(event)).statusCode,202);await processBillingEvent(db,provider,'sandbox');
 assert.equal((await app.inject(event)).statusCode,202);await processBillingEvent(db,provider,'sandbox');
 const grants=(await db.query('SELECT * FROM billing_grants WHERE billing_checkout_id=$1',[saved.billing_checkout_id])).rows;assert.equal(grants.length,1);assert.equal(grants[0]!.units_granted,units);assert.equal(new Date(grants[0]!.expires_at).getTime()-new Date(grants[0]!.valid_from).getTime(),days*86400000);
 }
 assert.equal((await app.inject({url:'/v1/billing/me',headers:buyerHeaders})).json().available_units,390);
 });
 await t.test('changing terms disables old offers without changing sold snapshots or grants',async()=>{
 const current=(await app.inject({url:'/v1/admin/billing/plans',headers})).json().plans.find((p:Json)=>p.plan_key==='plus');
 const updated=await app.inject({method:'PUT',url:'/v1/admin/billing/plans/'+plus.plan_id,headers,payload:{...input,monthly_amount:'3000.00',revision:current.revision}});assert.equal(updated.statusCode,200,updated.body);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM billing_offers WHERE plan_id=$1 AND is_enabled',[plus.plan_id])).rows[0]!.n,0);
 const saved=(await db.query('SELECT offer_snapshot FROM billing_checkouts ORDER BY created_at LIMIT 1')).rows[0]!.offer_snapshot;assert.equal(Number(saved.amount),2500);
 assert.equal((await db.query("SELECT count(*)::integer AS n FROM admin_audit_logs WHERE action LIKE 'billing.plans.%'")).rows[0]!.n>0,true);
 });
 }finally{await app.close();await db.close();}
});
