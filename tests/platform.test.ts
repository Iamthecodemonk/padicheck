import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOTP, Secret } from 'otpauth';
import { createHmac } from 'node:crypto';
import { loadConfig } from '../src/config.js';
import { testDatabase } from './support/database.js';
import { buildTestApp, completeRegistration } from './support/auth.js';
import type { GoogleIdentity } from '../src/modules/auth/identity-types.js';
import { ApiError } from '../src/errors.js';

const env={NODE_ENV:'test',LOG_LEVEL:'silent',DATABASE_URL:'postgres://unused:unused@localhost/test',JWT_SECRET:'test-platform-secret-32-bytes-long-enough',
  PLATFORM_EXTENSIONS_ENABLED:'true',ACCOUNT_ENCRYPTION_KEY:'ab'.repeat(32)};
const password='Strong platform test password 123!';
test('platform sessions, MFA, bookmarks, notifications, business teams and API keys',async t=>{
  const {db}=await testDatabase(true);
  let googleIdentity:GoogleIdentity|undefined;
  const app=buildTestApp(loadConfig(env),db,{auth:{google:{async verify(){if(!googleIdentity)throw new ApiError(401,'invalid_google_token','Invalid token');return googleIdentity;}}}});
  let sequence=0;
  const call=(method:'GET'|'POST'|'DELETE'|'PATCH',url:string,token?:string,payload?:object,extra:Record<string,string>={})=>app.inject({
    method,url,payload,headers:{...(token?{authorization:`Bearer ${token}`} : {}),...extra},remoteAddress:`192.0.2.${++sequence}`,
  });
  const signup=async(email:string)=>{const r=await completeRegistration(app,{email,display_name:email.split('@')[0]!,password});assert.equal(r.statusCode,201,r.body);return {id:r.json().user.users_id as string,token:r.json().access_token as string,email};};
  const login=async(email:string)=>call('POST','/v1/auth/login',undefined,{email,password});
  try{
    const owner=await signup('owner-platform@example.com');const other=await signup('other-platform@example.com');
    const viewer=await signup('viewer-platform@example.com');let ownerToken=owner.token;
    let investigation:string;let business:string;
    await t.test('session registry enforces ownership, individual revocation and logout everywhere',async()=>{
      const second=await login(owner.email);assert.equal(second.statusCode,200,second.body);
      const sessions=await call('GET','/v1/auth/sessions',ownerToken);assert.equal(sessions.json().sessions.length,2);
      const own=sessions.json().sessions.find((s:{is_current:boolean})=>s.is_current);
      assert.equal((await call('DELETE',`/v1/auth/sessions/${own.session_id}`,other.token)).statusCode,404);
      assert.equal((await call('DELETE',`/v1/auth/sessions/${own.session_id}`,ownerToken)).statusCode,204);
      assert.equal((await call('GET','/v1/auth/me',ownerToken)).statusCode,401);
      ownerToken=second.json().access_token;
      assert.equal((await call('POST','/v1/auth/logout-all',ownerToken)).statusCode,204);
      assert.equal((await call('GET','/v1/auth/me',ownerToken)).statusCode,401);
      ownerToken=(await login(owner.email)).json().access_token;
      const unsigned=[{alg:'HS256',typ:'JWT'},{sub:owner.id,jti:'unregistered',iss:'padicheck',aud:'padicheck-api',exp:Math.floor(Date.now()/1000)+900}]
        .map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
      const legacy=`${unsigned}.${createHmac('sha256',env.JWT_SECRET).update(unsigned).digest('base64url')}`;
      assert.equal((await call('GET','/v1/auth/me',legacy)).statusCode,401);
    });
    await t.test('bookmarks are persistent, idempotent and owner-only',async()=>{
      const created=await call('POST','/v1/investigations',ownerToken,{investigation_type:'general_research',user_prompt:'Research this source'});
      assert.equal(created.statusCode,202,created.body);investigation=created.json().investigation.investigation_id;
      assert.equal((await call('POST',`/v1/investigations/${investigation}/bookmark`,other.token)).statusCode,404);
      for(let i=0;i<2;i++)assert.equal((await call('POST',`/v1/investigations/${investigation}/bookmark`,ownerToken)).statusCode,200);
      const saved=await call('GET','/v1/me/bookmarks',ownerToken);assert.equal(saved.json().bookmarks.length,1);
      assert.equal((await call('GET','/v1/me/bookmarks',other.token)).json().bookmarks.length,0);
      assert.equal((await call('DELETE',`/v1/investigations/${investigation}/bookmark`,ownerToken)).statusCode,204);
    });
    await t.test('terminal notifications are transactional, deduplicated, private and respect preferences',async()=>{
      await db.query("UPDATE investigations SET status='completed' WHERE investigation_id=$1",[investigation]);
      await db.query("UPDATE investigations SET status='completed' WHERE investigation_id=$1",[investigation]);
      const listed=await call('GET','/v1/me/notifications?unread_only=true',ownerToken);assert.equal(listed.json().notifications.length,1);
      const id=listed.json().notifications[0].notification_id;
      assert.equal((await call('POST',`/v1/me/notifications/${id}/read`,other.token)).statusCode,404);
      assert.equal((await call('POST',`/v1/me/notifications/${id}/read`,ownerToken)).statusCode,200);
      assert.equal((await call('GET','/v1/me/notifications?unread_only=true',ownerToken)).json().notifications.length,0);
      assert.equal((await call('PATCH','/v1/me/notification-preferences',ownerToken,{notification_type:'investigation.failed',enabled:false})).statusCode,200);
      await db.query("UPDATE investigations SET status='failed' WHERE investigation_id=$1",[investigation]);
      assert.equal((await call('GET','/v1/me/notifications',ownerToken)).json().notifications.length,1);
      await assert.rejects(db.transaction(async client=>{await client.query("UPDATE investigations SET status='completed' WHERE investigation_id=$1",[investigation]);throw new Error('rollback');}));
      assert.equal((await call('GET','/v1/me/notifications',ownerToken)).json().notifications.length,1);
    });
    await t.test('business invitation acceptance requires matching verified identity; membership never grants staff roles',async()=>{
      const entity=(await db.query("INSERT INTO entities(entity_type,canonical_name) VALUES ('business','Team test') RETURNING entity_id")).rows[0]!.entity_id;
      business=(await db.query("INSERT INTO business_profiles(entity_id,business_category,claimed_by_user_id) VALUES ($1,'Test',$2) RETURNING business_profile_id",[entity,owner.id])).rows[0]!.business_profile_id;
      const invite=await call('POST',`/v1/businesses/${business}/invitations`,ownerToken,{email:other.email,member_role:'editor'});assert.equal(invite.statusCode,201,invite.body);
      const id=invite.json().invitation.invitation_id;
      assert.equal((await call('POST',`/v1/me/business-invitations/${id}/accept`,viewer.token)).statusCode,404);
      assert.equal((await call('GET','/v1/me/business-invitations',other.token)).json().invitations.length,1);
      assert.equal((await call('POST',`/v1/me/business-invitations/${id}/accept`,other.token)).json().accepted,true);
      assert.equal((await call('POST',`/v1/me/business-invitations/${id}/accept`,other.token)).statusCode,200);
      assert.equal((await call('PATCH',`/v1/businesses/${business}/profile`,other.token,{profile_description:'Edited by member'})).statusCode,200);
      assert.equal((await call('GET','/v1/admin/roles',other.token)).statusCode,403);
      assert.equal((await call('PATCH',`/v1/businesses/${business}/profile`,viewer.token,{profile_description:'Attack'})).statusCode,404);
      assert.equal((await call('POST',`/v1/businesses/${business}/invitations`,other.token,{email:viewer.email,member_role:'manager'})).statusCode,404);
      assert.equal((await call('PATCH',`/v1/businesses/${business}/team/${other.id}`,ownerToken,{member_role:'viewer'})).statusCode,200);
      assert.equal((await call('PATCH',`/v1/businesses/${business}/profile`,other.token,{profile_description:'Attack'})).statusCode,404);
    });
    await t.test('expired/revoked invitations and owner transfers cannot preserve old access',async()=>{
      const invite=await call('POST',`/v1/businesses/${business}/invitations`,ownerToken,{email:viewer.email,member_role:'editor'});
      const id=invite.json().invitation.invitation_id;
      assert.equal((await call('DELETE',`/v1/businesses/${business}/invitations/${id}`,ownerToken)).statusCode,204);
      assert.equal((await call('POST',`/v1/me/business-invitations/${id}/accept`,viewer.token)).statusCode,404);
      const again=await call('POST',`/v1/businesses/${business}/invitations`,ownerToken,{email:viewer.email,member_role:'editor'});
      await db.query("UPDATE business_invitations SET created_at=now()-interval '8 days',expires_at=now()-interval '1 day' WHERE invitation_id=$1",[again.json().invitation.invitation_id]);
      assert.equal((await call('POST',`/v1/me/business-invitations/${again.json().invitation.invitation_id}/accept`,viewer.token)).statusCode,404);
      await db.query('UPDATE business_profiles SET claimed_by_user_id=$2 WHERE business_profile_id=$1',[business,viewer.id]);
      assert.equal((await db.query('SELECT * FROM business_memberships WHERE business_profile_id=$1',[business])).rows.length,0);
      assert.equal((await call('GET',`/v1/businesses/${business}/team`,ownerToken)).statusCode,404);
    });
    await t.test('API keys store only hashes, enforce scopes/ownership, rotate and revoke immediately',async()=>{
      const made=await call('POST','/v1/me/api-keys',ownerToken,{name:'Read only',scopes:['investigations:read']});assert.equal(made.statusCode,201,made.body);
      const key=made.json().secret;const id=made.json().api_key.api_key_id;const headers={'x-api-key':key};
      assert.equal(made.json().api_key.key_hash,undefined);
      assert.notEqual((await db.query('SELECT key_hash FROM user_api_keys WHERE api_key_id=$1',[id])).rows[0]!.key_hash,key);
      assert.equal((await call('GET','/v1/investigations',undefined,undefined,headers)).statusCode,200);
      assert.equal((await call('GET','/v1/investigations?scope=all',undefined,undefined,headers)).statusCode,403);
      assert.equal((await call('POST','/v1/investigations',undefined,{investigation_type:'general_research',user_prompt:'Attack'},headers)).statusCode,403);
      assert.equal((await call('GET','/v1/auth/me',undefined,undefined,headers)).statusCode,403);
      assert.equal((await call('GET','/v1/investigations',ownerToken,undefined,headers)).statusCode,400);
      assert.equal((await call('DELETE',`/v1/me/api-keys/${id}`,other.token)).statusCode,404);
      const rotated=await call('POST',`/v1/me/api-keys/${id}/rotate`,ownerToken);assert.equal(rotated.statusCode,201,rotated.body);
      assert.equal((await call('GET','/v1/investigations',undefined,undefined,headers)).statusCode,401);
      const replacement=rotated.json().secret;
      const list=await call('GET','/v1/me/api-keys',ownerToken);assert.equal(list.body.includes(replacement),false);assert.equal(list.body.includes('key_hash'),false);
      await db.query("UPDATE user_api_keys SET rate_count=60,rate_window=date_trunc('minute',now()) WHERE api_key_id=$1",[rotated.json().api_key.api_key_id]);
      assert.equal((await call('GET','/v1/investigations',undefined,undefined,{'x-api-key':replacement})).statusCode,429);
      await call('DELETE',`/v1/me/api-keys/${rotated.json().api_key.api_key_id}`,ownerToken);
      assert.equal((await call('GET','/v1/investigations',undefined,undefined,{'x-api-key':replacement})).statusCode,401);
    });
    await t.test('API keys lose access when owner permissions or account status change',async()=>{
      const made=await call('POST','/v1/me/api-keys',other.token,{name:'Temporary',scopes:['investigations:read']});assert.equal(made.statusCode,201,made.body);
      const h={'x-api-key':made.json().secret};
      await db.query('DELETE FROM user_roles WHERE users_id=$1',[other.id]);
      assert.equal((await call('GET','/v1/investigations',undefined,undefined,h)).statusCode,403);
      await db.query("UPDATE users SET account_status='suspended' WHERE users_id=$1",[other.id]);
      assert.equal((await call('GET','/v1/investigations',undefined,undefined,h)).statusCode,401);
    });
    await t.test('MFA enrollment encrypts secrets and returns hashed single-use recovery codes only once',async()=>{
      const linkNonce=await call('POST','/v1/auth/google/challenge',ownerToken,{action:'link'});
      googleIdentity={sub:'google-platform-owner',email:owner.email,name:'Owner',nonce:linkNonce.json().nonce,authoritative_email:true};
      assert.equal((await call('POST','/v1/auth/google/link',ownerToken,{id_token:'signed-test-token'})).statusCode,200);
      const setup=await call('POST','/v1/auth/mfa/setup',ownerToken);assert.equal(setup.statusCode,200,setup.body);
      const secret=setup.json().secret;
      const factor=(await db.query('SELECT pending_ciphertext FROM auth_totp_factors WHERE users_id=$1',[owner.id])).rows[0]!;
      assert.equal(factor.pending_ciphertext.includes(secret),false);
      const code=new TOTP({secret:Secret.fromBase32(secret)}).generate();
      const confirmed=await call('POST','/v1/auth/mfa/confirm',ownerToken,{code});assert.equal(confirmed.statusCode,200,confirmed.body);
      const recovery=confirmed.json().recovery_codes as string[];assert.equal(recovery.length,10);
      assert.equal((await call('GET','/v1/auth/me',ownerToken)).statusCode,401);
      const challenges=await login(owner.email);assert.equal(challenges.json().mfa_required,true);assert.equal(challenges.json().access_token,undefined);
      assert.equal((await call('GET','/v1/auth/me',challenges.json().challenge_token)).statusCode,401);
      assert.equal((await call('POST','/v1/auth/mfa/verify',undefined,{challenge_token:challenges.json().challenge_token,code})).statusCode,401);
      const verified=await call('POST','/v1/auth/mfa/verify',undefined,{challenge_token:challenges.json().challenge_token,code:recovery[0]});
      assert.equal(verified.statusCode,200,verified.body);ownerToken=verified.json().access_token;
      assert.equal((await call('POST','/v1/auth/mfa/verify',undefined,{challenge_token:challenges.json().challenge_token,code:recovery[1]})).statusCode,401);
      const next=await login(owner.email);
      assert.equal((await call('POST','/v1/auth/mfa/verify',undefined,{challenge_token:next.json().challenge_token,code:recovery[0]})).statusCode,401);
      const status=await call('GET','/v1/auth/mfa',ownerToken);assert.equal(status.json().recovery_codes_remaining,9);assert.equal(status.body.includes(secret),false);
      const hashes=(await db.query('SELECT code_hash FROM auth_recovery_codes WHERE users_id=$1',[owner.id])).rows;
      assert.ok(hashes.every(row=>!recovery.includes(row.code_hash)));
      const googleNonce=await call('POST','/v1/auth/google/challenge',undefined,{action:'login'});
      googleIdentity={...googleIdentity,nonce:googleNonce.json().nonce};
      const googleLogin=await call('POST','/v1/auth/google',undefined,{id_token:'signed-test-token'});
      assert.equal(googleLogin.json().mfa_required,true);assert.equal(googleLogin.json().access_token,undefined);
      const regenerated=await call('POST','/v1/auth/mfa/recovery-codes',ownerToken,{code:recovery[1]});assert.equal(regenerated.statusCode,200,regenerated.body);
      const newCodes=regenerated.json().recovery_codes;
      assert.equal((await call('POST','/v1/auth/mfa/verify',undefined,{challenge_token:googleLogin.json().challenge_token,code:newCodes[0]})).statusCode,401);
      const fresh=await login(owner.email);
      assert.equal((await call('POST','/v1/auth/mfa/verify',undefined,{challenge_token:fresh.json().challenge_token,code:recovery[2]})).statusCode,401);
      const restored=await call('POST','/v1/auth/mfa/verify',undefined,{challenge_token:fresh.json().challenge_token,code:newCodes[0]});assert.equal(restored.statusCode,200,restored.body);ownerToken=restored.json().access_token;
      const disabled=await call('POST','/v1/auth/mfa/disable',ownerToken,{code:newCodes[1]});assert.equal(disabled.statusCode,200,disabled.body);
      assert.equal((await call('GET','/v1/auth/me',ownerToken)).statusCode,401);
      assert.equal((await login(owner.email)).json().mfa_required,undefined);
    });
    await t.test('failed MFA attempts persist and challenges cannot be brute-forced beyond five attempts',async()=>{
      ownerToken=(await login(owner.email)).json().access_token;
      const setup=await call('POST','/v1/auth/mfa/setup',ownerToken);const totp=new TOTP({secret:Secret.fromBase32(setup.json().secret)});
      assert.equal((await call('POST','/v1/auth/mfa/confirm',ownerToken,{code:totp.generate()})).statusCode,200);
      const challenge=(await login(owner.email)).json().challenge_token;
      const wrong='f'.repeat(24);
      for(let i=0;i<6;i++)assert.equal((await call('POST','/v1/auth/mfa/verify',undefined,{challenge_token:challenge,code:wrong})).statusCode,401);
      const row=(await db.query('SELECT attempts FROM auth_login_challenges ORDER BY created_at DESC LIMIT 1')).rows[0]!;assert.equal(row.attempts,5);
      const factor=(await db.query('SELECT failed_attempts,locked_until FROM auth_totp_factors WHERE users_id=$1',[owner.id])).rows[0]!;
      assert.equal(factor.failed_attempts,5);assert.ok(factor.locked_until);
    });
  }finally{await app.close();await db.close();}
});
