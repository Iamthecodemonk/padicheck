import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { encryptFactor } from '../src/modules/auth/security.js';
import { testDatabase } from './support/database.js';
import { authFixture } from './support/auth.js';

test('account profile and password recovery preserve account and factor boundaries',async t=>{
  const {db,postgres}=await testDatabase(true);const fixture=authFixture();
  const encryptionKey='a'.repeat(64);const email='recovery@example.test';const original='Original password 123!';const next='Changed password 456!';
  const user=(await db.query("INSERT INTO users(display_name,email,email_verified_at) VALUES ('Account user',$1,now()) RETURNING users_id",[email])).rows[0]!;
  await db.query("INSERT INTO user_auth_accounts(users_id,provider,password_hash,provider_email) VALUES ($1,'password',$2,$3)",[user.users_id,await hashPassword(original),email]);
  const app=buildApp(loadConfig({NODE_ENV:'test',LOG_LEVEL:'silent',DATABASE_URL:'postgres://unused:unused@localhost/test',JWT_SECRET:'test-secret-32-bytes-minimum-long-value',PLATFORM_EXTENSIONS_ENABLED:'true',ACCOUNT_ENCRYPTION_KEY:encryptionKey}),db,{auth:fixture});
  let address=0;const post=(url:string,payload:object,headers?:Record<string,string>)=>app.inject({method:'POST',url,payload,headers,remoteAddress:'192.0.2.'+(++address)});
  const login=()=>post('/v1/auth/login',{email,password:original});
  let headers:Record<string,string>;
  try{
    headers={authorization:'Bearer '+(await login()).json().access_token};
    await t.test('own profile updates reject privilege and email injection',async()=>{
      const changed=await app.inject({method:'PATCH',url:'/v1/me/account',headers,payload:{display_name:'Updated account',phone_number:'+2348035550142'}});
      assert.equal(changed.statusCode,200,changed.body);assert.equal(changed.json().account.display_name,'Updated account');
      assert.equal((await app.inject({method:'PATCH',url:'/v1/me/account',headers,payload:{roles:['superadmin']}})).statusCode,400);
      assert.equal((await app.inject({method:'PATCH',url:'/v1/me/account',headers,payload:{email:'attacker@example.test'}})).statusCode,400);
      const own=await app.inject({method:'GET',url:'/v1/me/account',headers});assert.deepEqual(own.json().providers,['password']);assert.ok(!own.body.includes('password_hash'));
    });
    await t.test('reset request conceals whether an account exists and stores no account for unknown email',async()=>{
      const unknown=await post('/v1/auth/password/reset/request',{email:'unknown@example.test'});assert.equal(unknown.statusCode,202,unknown.body);
      assert.deepEqual(Object.keys(unknown.json()).sort(),['challenge_id','expires_in','message']);assert.equal(fixture.delivered.has('unknown@example.test'),false);
      assert.equal((await db.query("SELECT 1 FROM users WHERE email='unknown@example.test'")).rowCount,0);
    });
    await t.test('wrong current password cannot change a password or revoke an active session',async()=>{
      const result=await post('/v1/auth/password/change',{current_password:'Wrong password 123!',new_password:next},headers);assert.equal(result.statusCode,401);
      assert.equal((await app.inject({method:'GET',url:'/v1/auth/me',headers})).statusCode,200);
    });
    await t.test('reset codes do not authorize signup; confirmed resets revoke sessions and retain MFA',async()=>{
      const issued=await post('/v1/auth/password/reset/request',{email});assert.equal(issued.statusCode,202,issued.body);const code=fixture.delivered.get(email)!;assert.match(code,/^\d{6}$/);
      assert.equal((await post('/v1/auth/register/verify',{email,challenge_id:issued.json().challenge_id,code})).statusCode,400);
      const wrong=await post('/v1/auth/password/reset/confirm',{email,challenge_id:issued.json().challenge_id,code:code==='000000'?'111111':'000000',new_password:next});assert.equal(wrong.statusCode,400);
      await db.query('INSERT INTO auth_totp_factors(users_id,secret_ciphertext,enabled_at) VALUES ($1,$2,now())',[user.users_id,encryptFactor('JBSWY3DPEHPK3PXP',encryptionKey,String(user.users_id))]);
      const payload={email,challenge_id:issued.json().challenge_id,code,new_password:next};
      const confirmed=await post('/v1/auth/password/reset/confirm',payload);assert.equal(confirmed.statusCode,200,confirmed.body);assert.equal(confirmed.json().access_token,undefined);
      assert.equal((await post('/v1/auth/password/reset/confirm',payload)).statusCode,400);
      assert.equal((await app.inject({method:'GET',url:'/v1/auth/me',headers})).statusCode,401);
      assert.equal((await login()).statusCode,401);
      const signin=await post('/v1/auth/login',{email,password:next});assert.equal(signin.json().mfa_required,true);assert.equal(signin.json().access_token,undefined);
      assert.equal((await db.query('SELECT 1 FROM auth_totp_factors WHERE users_id=$1 AND enabled_at IS NOT NULL',[user.users_id])).rowCount,1);
    });
    await t.test('password change revokes all sessions and accepts only the new password afterward',async()=>{
      await db.query('DELETE FROM auth_totp_factors WHERE users_id=$1',[user.users_id]);
      headers={authorization:'Bearer '+(await post('/v1/auth/login',{email,password:next})).json().access_token};
      const changed=await post('/v1/auth/password/change',{current_password:next,new_password:original},headers);assert.equal(changed.statusCode,200,changed.body);
      assert.equal((await app.inject({method:'GET',url:'/v1/auth/me',headers})).statusCode,401);assert.equal((await login()).statusCode,200);
    });
  }finally{await app.close();await postgres.close();}
});
