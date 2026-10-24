import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {testDatabase} from './support/database.js';
import {buildApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
import {authFixture} from './support/auth.js';
import {awardWelcome,consumeCredits} from '../src/modules/billing/credits.js';
import type {GoogleIdentity} from '../src/modules/auth/identity-types.js';

test('admin credit policy, verified signup awards and priced investigations',async t=>{
 const {db,postgres}=await testDatabase();
 await postgres.exec(await readFile(new URL('../db/migrations/003_billing.sql',import.meta.url),'utf8'));
 await postgres.exec(await readFile(new URL('../db/migrations/006_credits.sql',import.meta.url),'utf8'));
 const fixture=authFixture();const identities=new Map<string,GoogleIdentity>();
 const config=loadConfig({NODE_ENV:'test',LOG_LEVEL:'silent',DATABASE_URL:'postgres://unused:unused@localhost/test',JWT_SECRET:'credit-test-secret-with-enough-bytes',CREDITS_ENABLED:'true'});
 const app=buildApp(config,db,{auth:{...fixture,google:{async verify(token){const identity=identities.get(token);assert.ok(identity);return identity;}}}});
 let n=0;const post=(url:string,payload:Record<string,unknown>,headers?:Record<string,string>)=>app.inject({method:'POST',url,payload,headers,remoteAddress:`192.0.2.${++n}`});
 async function signup(email:string){const pending=await post('/v1/auth/register',{email,display_name:'Credit test',password:'A long test password 123!'});assert.equal(pending.statusCode,202,pending.body);
 assert.equal((await db.query('SELECT 1 FROM users WHERE email=$1',[email])).rowCount,0);
 const response=await post('/v1/auth/register/verify',{email,challenge_id:pending.json().challenge_id,code:fixture.delivered.get(email)!});assert.equal(response.statusCode,201,response.body);
 return {id:response.json().user.users_id as string,headers:{authorization:'Bearer '+response.json().access_token}};}
 async function google(email:string,sub:string,action='login',headers?:Record<string,string>){const nonce=await post('/v1/auth/google/challenge',{action},headers);const token='token-'+n;identities.set(token,{email,sub,name:'Credit Google',nonce:nonce.json().nonce,authoritative_email:true});return post(action==='link'?'/v1/auth/google/link':'/v1/auth/google',{id_token:token},headers);}
 try{
 const admin=await signup('credit-admin@example.com');
 await db.query("INSERT INTO user_roles(users_id,role_id) SELECT $1,role_id FROM roles WHERE role_key='superadmin'",[admin.id]);
 let policy=(await app.inject({url:'/v1/admin/credits/policy',headers:admin.headers})).json().policy;
 policy.welcome_credits=10;policy.costs.company_research=4;policy.costs.phone_lookup=2;policy.costs.property=6;
 await t.test('only superadmin can change validated policy; changes are audited and revision checked',async()=>{
 const ordinary=await signup('ordinary@example.com');
 assert.equal((await app.inject({method:'PUT',url:'/v1/admin/credits/policy',headers:ordinary.headers,payload:policy})).statusCode,403);
 const payload={welcome_credits:policy.welcome_credits,costs:policy.costs,revision:policy.revision};
 const saved=await app.inject({method:'PUT',url:'/v1/admin/credits/policy',headers:admin.headers,payload});assert.equal(saved.statusCode,200,saved.body);policy=saved.json().policy;
 assert.equal((await app.inject({method:'PUT',url:'/v1/admin/credits/policy',headers:admin.headers,payload})).statusCode,409);
 assert.equal((await app.inject({method:'PUT',url:'/v1/admin/credits/policy',headers:admin.headers,payload:{...payload,revision:policy.revision,welcome_credits:-1}})).statusCode,400);
 assert.equal((await db.query("SELECT * FROM admin_audit_logs WHERE action='credits.policy.update'")).rowCount,1);
 });
 const user=await signup('credit-user@example.com');
 await t.test('welcome awarded once after verification, never on login, linking or repeat calls',async()=>{
 assert.equal((await app.inject({url:'/v1/credits/me',headers:user.headers})).json().available_units,10);
 await db.transaction(client=>awardWelcome(client,user.id,'sandbox'));
 await post('/v1/auth/login',{email:'credit-user@example.com',password:'A long test password 123!'});
 assert.equal((await google('credit-user@example.com','linked-sub','link',user.headers)).statusCode,200);
 assert.equal((await google('credit-user@example.com','linked-sub')).statusCode,200);
 assert.equal((await db.query("SELECT * FROM billing_grants WHERE users_id=$1 AND source_type='welcome'",[user.id])).rowCount,1);
 const newGoogle=await google('new-google@example.com','new-sub');assert.equal(newGoogle.statusCode,200,newGoogle.body);
 assert.equal((await db.query('SELECT amount FROM welcome_credit_awards WHERE users_id=$1',[newGoogle.json().user.users_id])).rows[0]!.amount,10);
 });
 let investigationId:string;
 await t.test('each type uses admin cost; stale quotes and insufficient balances roll back creation',async()=>{
 const company={investigation_type:'company_research',user_prompt:'Research example business',expected_credit_cost:4};
 const started=await post('/v1/investigations',company,user.headers);assert.equal(started.statusCode,202,started.body);investigationId=started.json().investigation.investigation_id;
 assert.equal((await app.inject({url:'/v1/credits/me',headers:user.headers})).json().available_units,6);
 const stale=await post('/v1/investigations',{...company,expected_credit_cost:3},user.headers);assert.equal(stale.statusCode,409,stale.body);assert.equal(stale.json().error.code,'credit_price_changed');
 const property=await post('/v1/investigations',{investigation_type:'general_research',user_prompt:'Research a public property',input_data:{check_context:'property'},expected_credit_cost:6},user.headers);assert.equal(property.statusCode,202,property.body);
 const denied=await post('/v1/investigations',company,user.headers);assert.equal(denied.statusCode,402,denied.body);
 assert.equal(Number((await db.query('SELECT count(*) FROM investigations WHERE user_id=$1',[user.id])).rows[0]!.count),2);
 const history=(await app.inject({url:'/v1/credits/me',headers:user.headers})).json();assert.equal(history.available_units,0);assert.equal(history.transactions.filter((row:{amount:number})=>row.amount<0).length,2);
 assert.equal((await app.inject({url:'/v1/billing/me',headers:user.headers})).json().enabled,true);
 });
 await t.test('debit is idempotent and can allocate across multiple grants',async()=>{
 await db.transaction(client=>consumeCredits(client,user.id,investigationId,'sandbox',{investigation_type:'company_research',user_prompt:'same'}));
 const multi=await signup('multi@example.com');
 await db.query('UPDATE billing_grants SET units_used=8 WHERE users_id=$1',[multi.id]);
 // A second valid welcome-origin grant is forbidden by the application award receipt;
 // use another provider_source_id only as an explicit allocation fixture.
 await db.query("INSERT INTO billing_grants(users_id,environment,source_type,provider_source_id,units_granted,valid_from) VALUES($1,'sandbox','welcome','allocation-fixture',3,now())",[multi.id]);
 const result=await post('/v1/investigations',{investigation_type:'company_research',user_prompt:'Split allocation',expected_credit_cost:4},multi.headers);assert.equal(result.statusCode,202,result.body);
 const allocations=await db.query('SELECT units FROM billing_usage WHERE investigation_id=$1',[result.json().investigation.investigation_id]);assert.equal(allocations.rowCount,2);assert.equal(allocations.rows.reduce((sum,r)=>sum+r.units,0),4);
 });
 await t.test('phone and shopping categories use their own prices and reject forged contexts',async()=>{
 const login=await google('new-google@example.com','new-sub');const headers={authorization:'Bearer '+login.json().access_token};
 const phone=await post('/v1/investigations',{investigation_type:'phone_lookup',user_prompt:'Check a phone',expected_credit_cost:2,input_data:{check_context:'phone',targets:[{entity_type:'other',canonical_name:'Public test number',identifiers:[{identifier_type:'phone',value:'+14155552671'}]}]}},headers);assert.equal(phone.statusCode,202,phone.body);
 const shop=await post('/v1/investigations',{investigation_type:'general_research',user_prompt:'Check a shopping offer',expected_credit_cost:1,input_data:{check_context:'shopping'}},headers);assert.equal(shop.statusCode,202,shop.body);
 assert.equal((await app.inject({url:'/v1/credits/me',headers})).json().available_units,7);
 const forged=await post('/v1/investigations',{investigation_type:'company_research',user_prompt:'Business with wrong context',input_data:{check_context:'shopping'}},headers);assert.equal(forged.statusCode,400,forged.body);
 });
 await t.test('policy changes affect future accounts only; zero bonus is still recorded once; zero-cost checks work',async()=>{
 const saved=await app.inject({method:'PUT',url:'/v1/admin/credits/policy',headers:admin.headers,payload:{welcome_credits:0,costs:{...policy.costs,general_research:0},revision:policy.revision}});assert.equal(saved.statusCode,200,saved.body);
 const zero=await signup('zero@example.com');assert.equal((await db.query('SELECT amount FROM welcome_credit_awards WHERE users_id=$1',[zero.id])).rows[0]!.amount,0);
 const free=await post('/v1/investigations',{investigation_type:'general_research',user_prompt:'Free general research',expected_credit_cost:0},zero.headers);assert.equal(free.statusCode,202,free.body);
 assert.equal((await db.query('SELECT amount FROM welcome_credit_awards WHERE users_id=$1',[user.id])).rows[0]!.amount,10);
 });
 }finally{await app.close();await db.close();}
});
