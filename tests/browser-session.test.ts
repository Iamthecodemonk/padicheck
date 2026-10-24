import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './support/database.js';
import {buildTestApp,completeRegistration} from './support/auth.js';
import {loadConfig} from '../src/config.js';
import {digest} from '../src/modules/auth/security.js';

test('browser sessions restore across navigation and obey expiry, MFA and revocation',async t=>{
 const {db}=await testDatabase(true);
 const app=buildTestApp(loadConfig({NODE_ENV:'test',LOG_LEVEL:'silent',DATABASE_URL:'postgres://unused:unused@localhost/test',JWT_SECRET:'browser-session-test-secret-with-enough-bytes',PLATFORM_EXTENSIONS_ENABLED:'true',ACCOUNT_ENCRYPTION_KEY:'a'.repeat(64)}),db);
 const email='browser-session@example.com',password='Browser session password 123!';
 const sessionHeaders=(cookie:string)=>({cookie,'x-padicheck-session':'1'});
 let token='',cookie='',userId='';
 try{
 await t.test('verified login issues opaque HttpOnly cookie and stores only its hash',async()=>{
 const result=await completeRegistration(app,{email,password,display_name:'Browser test'});assert.equal(result.statusCode,201,result.body);
 token=result.json().access_token;userId=result.json().user.users_id;
 const raw=String(result.headers['set-cookie']);assert.match(raw,/HttpOnly/);assert.match(raw,/SameSite=Lax/);assert.match(raw,/Path=\/v1\/auth\/session/);assert.match(raw,/Max-Age=604800/);
 cookie=raw.split(';')[0]!;const value=cookie.split('=')[1]!;assert.match(value,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(value,token);
 const row=(await db.query('SELECT browser_token_hash,browser_jti FROM auth_sessions WHERE users_id=$1',[userId])).rows[0]!;
 assert.equal(row.browser_token_hash,digest(value));assert.notEqual(row.browser_token_hash,value);
 const secure=await app.inject({method:'POST',url:'/v1/auth/login',payload:{email,password},headers:{'x-forwarded-proto':'https'}});assert.match(String(secure.headers['set-cookie']),/; Secure/);
 });
 await t.test('restoration returns a fresh bearer; cookies alone cannot authorize ordinary APIs',async()=>{
 const result=await app.inject({method:'POST',url:'/v1/auth/session',headers:sessionHeaders(cookie)});assert.equal(result.statusCode,200,result.body);assert.equal(result.json().token_type,'Bearer');token=result.json().access_token;
 assert.equal((await app.inject({url:'/v1/auth/me',headers:{authorization:'Bearer '+token}})).statusCode,200);
 assert.equal((await app.inject({url:'/v1/auth/me',headers:{cookie}})).statusCode,401);
 assert.equal(result.headers['cache-control'],'no-store');
 });
 await t.test('cross-site/simple-form requests, tampering and MFA tokens cannot restore',async()=>{
 assert.equal((await app.inject({method:'POST',url:'/v1/auth/session',headers:{cookie}})).statusCode,403);
 assert.equal((await app.inject({method:'POST',url:'/v1/auth/session',headers:{...sessionHeaders(cookie),'sec-fetch-site':'cross-site'}})).statusCode,403);
 const bad=await app.inject({method:'POST',url:'/v1/auth/session',headers:sessionHeaders(cookie+'x')});assert.equal(bad.statusCode,401);assert.match(String(bad.headers['set-cookie']),/Max-Age=0/);
 await db.query("INSERT INTO auth_totp_factors(users_id,secret_ciphertext,enabled_at) VALUES($1,'explicit-test-fixture',now())",[userId]);
 const challenge=await app.inject({method:'POST',url:'/v1/auth/login',payload:{email,password}});assert.equal(challenge.json().mfa_required,true);assert.equal(challenge.headers['set-cookie'],undefined);
 const mfaCookie='padicheck_session='+challenge.json().challenge_token;
 assert.equal((await app.inject({method:'POST',url:'/v1/auth/session',headers:sessionHeaders(mfaCookie)})).statusCode,401);
 await db.query('DELETE FROM auth_totp_factors WHERE users_id=$1',[userId]);
 });
 await t.test('renewal preserves absolute expiry and recent-authentication boundary',async()=>{
 const before=(await db.query('SELECT browser_expires_at FROM auth_sessions WHERE browser_token_hash=$1',[digest(cookie.split('=')[1]!)])).rows[0]!;
 await db.query("UPDATE auth_sessions SET authenticated_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE browser_token_hash=$1",[digest(cookie.split('=')[1]!)]);
 const restored=await app.inject({method:'POST',url:'/v1/auth/session',headers:sessionHeaders(cookie)});assert.equal(restored.statusCode,200,restored.body);token=restored.json().access_token;
 const after=(await db.query('SELECT authenticated_at,browser_expires_at FROM auth_sessions WHERE browser_token_hash=$1',[digest(cookie.split('=')[1]!)])).rows[0]!;
 assert.equal(new Date(before.browser_expires_at).getTime(),new Date(after.browser_expires_at).getTime());assert.ok(new Date(after.authenticated_at).getTime()<Date.now()-3600000);
 const recent=await app.inject({method:'POST',url:'/v1/auth/mfa/setup',headers:{authorization:'Bearer '+token}});assert.equal(recent.statusCode,403,recent.body);
 });
 await t.test('cookie logout revokes the session and prevents restoration and bearer reuse',async()=>{
 const logout=await app.inject({method:'DELETE',url:'/v1/auth/session',headers:sessionHeaders(cookie)});assert.equal(logout.statusCode,204);assert.match(String(logout.headers['set-cookie']),/Max-Age=0/);
 assert.equal((await app.inject({method:'POST',url:'/v1/auth/session',headers:sessionHeaders(cookie)})).statusCode,401);
 assert.equal((await app.inject({url:'/v1/auth/me',headers:{authorization:'Bearer '+token}})).statusCode,401);
 });
 await t.test('suspended accounts and expired browser sessions cannot renew',async()=>{
 const login=await app.inject({method:'POST',url:'/v1/auth/login',payload:{email,password}});const current=String(login.headers['set-cookie']).split(';')[0]!;
 await db.query("UPDATE users SET account_status='suspended' WHERE users_id=$1",[userId]);
 assert.equal((await app.inject({method:'POST',url:'/v1/auth/session',headers:sessionHeaders(current)})).statusCode,401);
 await db.query("UPDATE users SET account_status='active' WHERE users_id=$1",[userId]);
 await db.query("UPDATE auth_sessions SET browser_expires_at=now()-interval '1 second' WHERE users_id=$1",[userId]);
 assert.equal((await app.inject({method:'POST',url:'/v1/auth/session',headers:sessionHeaders(current)})).statusCode,401);
 });
 }finally{await app.close();await db.close();}
});
