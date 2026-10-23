import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { testDatabase } from './support/database.js';
import { authFixture } from './support/auth.js';
import type { GoogleIdentity } from '../src/modules/auth/identity-types.js';
import { ApiError } from '../src/errors.js';
import { googleIdentity } from '../src/adapters/google-identity.js';
import type { TokenPayload } from 'google-auth-library';

const env={NODE_ENV:'test',LOG_LEVEL:'silent',DATABASE_URL:'postgres://unused:unused@localhost/test',JWT_SECRET:'test-secret-32-bytes-minimum-long-value'};
test('email signup and Google identity flows enforce verification and account boundaries',async t=>{
  const {db,postgres}=await testDatabase();let now=Date.now();const fixture=authFixture(()=>now);
  const identities=new Map<string,GoogleIdentity>();
  const app=buildApp(loadConfig(env),db,{auth:{...fixture,google:{async verify(token){const value=identities.get(token);if(!value)throw new ApiError(401,'invalid_google_token','Google sign-in could not be verified');return value;}}}});
  let requestNumber=0;
  const post=(url:string,payload:Record<string,unknown>,headers?:Record<string,string>)=>app.inject({method:'POST',url,payload,headers,remoteAddress:`192.0.2.${++requestNumber}`});
  const credentials={email:'otp@example.com',display_name:'OTP user',password:'Strong test password long enough'};
  const signup=(email=credentials.email)=>post('/v1/auth/register',{...credentials,email});
  const verify=(email:string,id:string,code:string)=>post('/v1/auth/register/verify',{email,challenge_id:id,code});
  let ownerId:string;let headers:Record<string,string>;
  async function googleToken(email:string,sub:string,action='login',ownerHeaders?:Record<string,string>,authoritative=true){
    const challenge=await post('/v1/auth/google/challenge',{action},ownerHeaders);assert.equal(challenge.statusCode,200,challenge.body);
    const token=`fixture-${requestNumber}`;identities.set(token,{email,sub,name:'Google fixture',nonce:challenge.json().nonce,authoritative_email:authoritative});return token;
  }
  try{
    await t.test('signup sends a six-digit code without creating an account or returning credentials',async()=>{
      const response=await signup();assert.equal(response.statusCode,202,response.body);assert.equal(response.headers['cache-control'],'no-store');
      assert.equal(response.json().access_token,undefined);assert.equal(response.json().code,undefined);assert.equal(response.json().password_hash,undefined);
      assert.match(fixture.delivered.get(credentials.email)!,/^[0-9]{6}$/);
      assert.equal(Number((await db.query('SELECT count(*) FROM users')).rows[0]!.count),0);
      const login=await post('/v1/auth/login',credentials);assert.equal(login.statusCode,400); // display_name is not a login field
      const invalid=await post('/v1/auth/login',{email:credentials.email,password:credentials.password});assert.equal(invalid.statusCode,401);
      const result=await verify(credentials.email.toUpperCase(),response.json().challenge_id,fixture.delivered.get(credentials.email)!);
      assert.equal(result.statusCode,201,result.body);ownerId=result.json().user.users_id;headers={authorization:`Bearer ${result.json().access_token}`};
      assert.equal(result.json().user.email_verified,true);
      assert.ok((await db.query('SELECT email_verified_at FROM users WHERE users_id=$1',[ownerId])).rows[0]!.email_verified_at);
      assert.equal((await verify(credentials.email,response.json().challenge_id,fixture.delivered.get(credentials.email)!)).statusCode,400);
      assert.equal((await post('/v1/auth/login',{email:credentials.email,password:credentials.password})).statusCode,200);
    });
    await t.test('an abandoned unverified signup does not register or reserve the email',async()=>{
      const email='abandoned@example.com';const first=await signup(email);
      assert.equal(first.statusCode,202,first.body);const oldCode=fixture.delivered.get(email)!;
      now+=600001;
      const restarted=await signup(email.toUpperCase());assert.equal(restarted.statusCode,202,restarted.body);
      assert.equal((await db.query('SELECT 1 FROM users WHERE lower(email)=lower($1)',[email])).rowCount,0);
      assert.equal((await db.query('SELECT 1 FROM user_auth_accounts WHERE lower(provider_email)=lower($1)',[email])).rowCount,0);
      assert.equal((await verify(email,first.json().challenge_id,oldCode)).statusCode,400);
      const completed=await verify(email,restarted.json().challenge_id,fixture.delivered.get(email)!);
      assert.equal(completed.statusCode,201,completed.body);
      assert.equal((await signup(email)).statusCode,409);
    });
    await t.test('duplicate accounts return a sign-in conflict without sending or storing another OTP',async()=>{
      fixture.delivered.delete(credentials.email);
      const original=fixture.challenges.putOtp;let writes=0;
      fixture.challenges.putOtp=async(...args)=>{writes++;return original(...args);};
      try{
        for(const email of [credentials.email,credentials.email.toUpperCase()]){
          const duplicate=await signup(email);assert.equal(duplicate.statusCode,409,duplicate.body);
          assert.equal(duplicate.json().error.code,'account_exists');assert.match(duplicate.json().error.message,/sign in/i);
          assert.equal(duplicate.json().challenge_id,undefined);assert.equal(duplicate.json().access_token,undefined);
        }
        assert.equal(writes,0);assert.equal(fixture.delivered.has(credentials.email),false);
      }finally{fixture.challenges.putOtp=original;}
      assert.equal(Number((await db.query('SELECT count(*) FROM users WHERE lower(email)=lower($1)',[credentials.email])).rows[0]!.count),1);
    });
    await t.test('five failed attempts invalidate a code and expired codes cannot create users',async()=>{
      const email='attempts@example.com';const pending=await signup(email);const code=fixture.delivered.get(email)!;
      const wrong=code==='000000'?'111111':'000000';
      for(let i=0;i<5;i++)assert.equal((await verify(email,pending.json().challenge_id,wrong)).statusCode,400);
      assert.equal((await verify(email,pending.json().challenge_id,code)).statusCode,400);
      const expired=await signup('expired@example.com');const expiredCode=fixture.delivered.get('expired@example.com')!;now+=600001;
      assert.equal((await verify('expired@example.com',expired.json().challenge_id,expiredCode)).statusCode,400);
    });
    await t.test('resend replaces the previous challenge and the hourly quota is shared across requests',async()=>{
      const email='resend@example.com';const first=await signup(email);const old=fixture.delivered.get(email)!;
      assert.equal((await signup(email)).statusCode,429);now+=60001;
      const second=await signup(email);assert.equal((await verify(email,first.json().challenge_id,old)).statusCode,400);
      let latest=second;
      for(let i=0;i<3;i++){now+=60001;latest=await signup(email);assert.equal(latest.statusCode,202);}
      now+=60001;assert.equal((await signup(email)).statusCode,429);
      assert.equal((await verify(email,latest.json().challenge_id,fixture.delivered.get(email)!)).statusCode,201);
    });
    await t.test('email delivery and database failures create no partial accounts',async()=>{
      fixture.failDelivery(true);assert.equal((await signup('delivery@example.com')).statusCode,503);fixture.failDelivery(false);
      const pending=await signup('rollback@example.com');
      await postgres.exec(`CREATE FUNCTION identity_insert_failure() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'SECRET_DRIVER_ERROR'; END; $$ LANGUAGE plpgsql;
        CREATE TRIGGER identity_insert_failure BEFORE INSERT ON user_auth_accounts FOR EACH ROW EXECUTE FUNCTION identity_insert_failure();`);
      try{const response=await verify('rollback@example.com',pending.json().challenge_id,fixture.delivered.get('rollback@example.com')!);assert.equal(response.statusCode,500);assert.ok(!response.body.includes('SECRET'));}
      finally{await postgres.exec('DROP TRIGGER identity_insert_failure ON user_auth_accounts; DROP FUNCTION identity_insert_failure();');}
      assert.equal((await db.query("SELECT 1 FROM users WHERE email='rollback@example.com'")).rowCount,0);
    });
    await t.test('legacy accounts can verify their existing email without changing credentials',async()=>{
      await db.query('UPDATE users SET email_verified_at=NULL WHERE users_id=$1',[ownerId]);now+=60001;
      const pending=await post('/v1/auth/email/request',{},headers);assert.equal(pending.statusCode,202,pending.body);
      const payload={email:credentials.email,challenge_id:pending.json().challenge_id,code:fixture.delivered.get(credentials.email)!};
      assert.equal((await post('/v1/auth/register/verify',payload)).statusCode,400);
      assert.equal((await post('/v1/auth/email/verify',payload,headers)).statusCode,200);
      assert.equal((await post('/v1/auth/email/verify',payload,headers)).statusCode,400);
    });
    await t.test('Google creates a verified default-role account and rejects replay and expired nonces',async()=>{
      const token=await googleToken('google@gmail.com','google-subject');
      const response=await post('/v1/auth/google',{id_token:token});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().user.email_verified,true);
      const roles=await db.query('SELECT r.role_key FROM user_roles ur JOIN roles r ON r.role_id=ur.role_id WHERE ur.users_id=$1',[response.json().user.users_id]);assert.deepEqual(roles.rows.map(row=>row.role_key),['user']);
      assert.equal((await post('/v1/auth/google',{id_token:token})).statusCode,401);
      const expired=await googleToken('google@gmail.com','google-subject');now+=300001;assert.equal((await post('/v1/auth/google',{id_token:expired})).statusCode,401);
    });
    await t.test('Google cannot silently merge an existing password account or trust a third-party email',async()=>{
      const token=await googleToken(credentials.email,'owner-google');assert.equal((await post('/v1/auth/google',{id_token:token})).statusCode,409);
      const external=await googleToken('external@example.com','third-party','login',undefined,false);assert.equal((await post('/v1/auth/google',{id_token:external})).statusCode,409);
      assert.equal((await db.query("SELECT 1 FROM user_auth_accounts WHERE provider='google' AND users_id=$1",[ownerId])).rowCount,0);
    });
    await t.test('linking requires authentication, matching verified email and a link-scoped nonce',async()=>{
      assert.equal((await post('/v1/auth/google/challenge',{action:'link'})).statusCode,401);
      const wrong=await googleToken('wrong@gmail.com','wrong-google','link',headers);assert.equal((await post('/v1/auth/google/link',{id_token:wrong},headers)).statusCode,409);
      const loginOnly=await googleToken(credentials.email,'owner-google');assert.equal((await post('/v1/auth/google/link',{id_token:loginOnly},headers)).statusCode,401);
      const token=await googleToken(credentials.email,'owner-google','link',headers);assert.equal((await post('/v1/auth/google/link',{id_token:token},headers)).statusCode,200);
      const login=await googleToken(credentials.email,'owner-google','login',undefined,false);
      const result=await post('/v1/auth/google',{id_token:login});assert.equal(result.statusCode,200,result.body);assert.equal(result.json().user.users_id,ownerId);
      const logs=await db.query("SELECT * FROM admin_audit_logs WHERE action='auth.google.link'");assert.equal(logs.rows.length,1);assert.ok(!JSON.stringify(logs.rows).includes(token));
    });
    await t.test('subject identity survives email claims changing and suspension still blocks Google login',async()=>{
      const token=await googleToken('changed@gmail.com','owner-google');const result=await post('/v1/auth/google',{id_token:token});assert.equal(result.statusCode,200);assert.equal(result.json().user.email,credentials.email);
      await db.query("UPDATE users SET account_status='suspended' WHERE users_id=$1",[ownerId]);
      const suspended=await googleToken(credentials.email,'owner-google');assert.equal((await post('/v1/auth/google',{id_token:suspended})).statusCode,401);
      await db.query("UPDATE users SET account_status='active' WHERE users_id=$1",[ownerId]);
    });
    await t.test('missing integrations fail closed, and identity payloads cannot assign roles',async()=>{
      const plain=buildApp(loadConfig(env),db);
      try{
        assert.equal((await plain.inject({method:'POST',url:'/v1/auth/register',payload:credentials})).statusCode,503);
        assert.equal((await plain.inject({method:'POST',url:'/v1/auth/google/challenge',payload:{}})).statusCode,503);
      }finally{await plain.close();}
      assert.equal((await post('/v1/auth/google',{id_token:'invalid',roles:['superadmin']})).statusCode,400);
      assert.equal((await post('/v1/auth/google',{id_token:'invalid'})).statusCode,401);
    });
  }finally{await app.close();await fixture.challenges.close();await db.close();}
});

test('Google adapter delegates audience/signature verification and validates verified identity claims',async()=>{
  const clientId='fixture.apps.googleusercontent.com';let called=false;
  const valid:TokenPayload & {nonce:string}={iss:'https://accounts.google.com',aud:clientId,sub:'subject',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,email:'user@gmail.com',email_verified:true,nonce:'a'.repeat(43)};
  const verify=async(payload:typeof valid)=>googleIdentity(clientId,async(token,audience)=>{assert.equal(token,'signed-token');assert.equal(audience,clientId);called=true;return payload;}).verify('signed-token');
  assert.equal((await verify(valid)).authoritative_email,true);assert.equal(called,true);
  for(const change of [{aud:'other-client'},{iss:'https://attacker.test'},{exp:1},{email_verified:false},{nonce:''},{sub:''}])await assert.rejects(verify({...valid,...change}),/Google sign-in could not be verified/);
  const thirdParty=await verify({...valid,email:'external@example.com'});assert.equal(thirdParty.authoritative_email,false);
  assert.equal((await verify({...valid,email:'workspace@example.com',hd:'example.com'})).authoritative_email,true);
  await assert.rejects(googleIdentity(clientId,async()=>{throw new Error('SECRET_CERTIFICATE_ERROR');}).verify('bad-token'),error=>{assert.ok(!String(error).includes('SECRET'));return true;});
});
