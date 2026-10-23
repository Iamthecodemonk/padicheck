import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {testDatabase} from './support/database.js';
import {buildApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
import {hashPassword} from '../src/modules/auth/password.js';
test('draft business ownership and visibility are enforced by the server',async()=>{
 const {db,postgres}=await testDatabase(true);await postgres.exec(await readFile(new URL('../db/migrations/005_business_details.sql',import.meta.url),'utf8'));
 const app=buildApp(loadConfig({NODE_ENV:'test',LOG_LEVEL:'silent',DATABASE_URL:'postgres://unused:unused@localhost/test',JWT_SECRET:'test-secret-32-bytes-minimum-long-value',PLATFORM_EXTENSIONS_ENABLED:'true',ACCOUNT_ENCRYPTION_KEY:'a'.repeat(64)}),db);
 const password='Business account password 123!';const hash=await hashPassword(password);
 async function account(email:string){const row=(await db.query("INSERT INTO users(display_name,email,email_verified_at) VALUES ('Business user',$1,now()) RETURNING users_id",[email])).rows[0]!;await db.query("INSERT INTO user_auth_accounts(users_id,provider,password_hash,provider_email) VALUES ($1,'password',$2,$3)",[row.users_id,hash,email]);const response=await app.inject({method:'POST',url:'/v1/auth/login',payload:{email,password}});return {id:row.users_id,headers:{authorization:'Bearer '+response.json().access_token}};}
 try{const owner=await account('business-owner@example.test');const other=await account('business-other@example.test');
 const payload={canonical_name:'Test owner business',business_category:'Services',profile_description:'A real draft description of sufficient length for validation.',city:'Lagos',phone:'+2348035550142',email:'contact@example.test',opening_hours:'Mon-Fri 9-5'};
 const created=await app.inject({method:'POST',url:'/v1/businesses',headers:owner.headers,payload});assert.equal(created.statusCode,201,created.body);const id=created.json().business.business_profile_id;assert.equal(created.json().business.profile_status,'draft');
 assert.equal((await app.inject({method:'POST',url:'/v1/businesses',headers:owner.headers,payload})).statusCode,409);
 assert.equal((await app.inject({method:'GET',url:'/v1/directory/'+id})).statusCode,404);
 assert.equal((await app.inject({method:'GET',url:'/v1/businesses/'+id,headers:other.headers})).statusCode,404);
 const detail=await app.inject({method:'GET',url:'/v1/businesses/'+id,headers:owner.headers});assert.equal(detail.statusCode,200,detail.body);assert.equal(detail.json().business.profile_details.opening_hours,'Mon-Fri 9-5');assert.equal(detail.json().verification_review,null);
 const list=await app.inject({method:'GET',url:'/v1/me/businesses',headers:owner.headers});assert.equal(list.json().businesses[0].member_role,'owner');
 const hidden=await app.inject({method:'GET',url:'/v1/me/businesses',headers:other.headers});assert.equal(hidden.json().businesses.length,0);
 await db.query("INSERT INTO business_memberships(business_profile_id,users_id,member_role) VALUES ($1,$2,'viewer')",[id,other.id]);
 assert.equal((await app.inject({method:'GET',url:'/v1/businesses/'+id,headers:other.headers})).statusCode,200);
 assert.equal((await app.inject({method:'PATCH',url:'/v1/businesses/'+id+'/profile',headers:other.headers,payload:{profile_description:'Viewer must not be able to change this profile'}})).statusCode,404);
 const denied=await app.inject({method:'PATCH',url:'/v1/businesses/'+id+'/details',headers:other.headers,payload:{canonical_name:'Viewer edit'}});assert.equal(denied.statusCode,404);
 const edited=await app.inject({method:'PATCH',url:'/v1/businesses/'+id+'/details',headers:owner.headers,payload:{canonical_name:'Updated business name',phone:'+2348035550143'}});assert.equal(edited.statusCode,200,edited.body);assert.equal(edited.json().reverification_required,true);
 const fresh=await app.inject({method:'GET',url:'/v1/businesses/'+id,headers:owner.headers});assert.equal(fresh.json().business.canonical_name,'Updated business name');assert.ok(fresh.json().business.profile_details.verification_invalidated_at);assert.equal(fresh.json().identifiers.find((x:{identifier_type:string})=>x.identifier_type==='phone').value,'+2348035550143');
 assert.equal((await app.inject({method:'GET',url:'/v1/businesses/'+id+'/reports',headers:owner.headers})).json().reports.length,0);
 const forbidden=await app.inject({method:'POST',url:'/v1/businesses',headers:owner.headers,payload:{...payload,claimed_by_user_id:other.id}});assert.equal(forbidden.statusCode,400);
 }finally{await app.close();await postgres.close();}
});
