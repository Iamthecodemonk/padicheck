import assert from 'node:assert/strict';
import { buildApp } from '../../src/app.js';
import type { AuthChallenges, PendingOtp, OtpMailer } from '../../src/modules/auth/identity-types.js';

// Explicit test doubles. Production never falls back to an in-memory OTP store
// or a mail sink, including when SMTP/Redis configuration is missing.
export function authFixture(clock=()=>Date.now()){
  const otp=new Map<string,{data:PendingOtp;attempts:number;expires:number}>();
  const limits=new Map<string,{next:number;count:number;expires:number}>();
  const nonces=new Map<string,{context:string;expires:number}>();
  const delivered=new Map<string,string>();
  let failMail=false;
  const challenges:AuthChallenges={
    async putOtp(key,data){
      let limit=limits.get(key);if(!limit||limit.expires<=clock())limit={next:0,count:0,expires:clock()+3600000};
      if(limit.next>clock()||limit.count>=5)return false;
      limits.set(key,{...limit,next:clock()+60000,count:limit.count+1});
      otp.set(key,{data,attempts:0,expires:clock()+600000});return true;
    },
    async consumeOtp(key,id,digest,purpose){
      const value=otp.get(key);if(!value||value.expires<=clock()||value.data.challenge_id!==id||value.data.purpose!==purpose)return null;
      value.attempts++;if(value.attempts>=5||value.data.code_digest===digest)otp.delete(key);
      return value.attempts<=5&&value.data.code_digest===digest?value.data:null;
    },
    async discardOtp(key,id){if(otp.get(key)?.data.challenge_id===id)otp.delete(key);},
    async putNonce(key,context){nonces.set(key,{context,expires:clock()+300000});},
    async consumeNonce(key,context){const value=nonces.get(key);if(!value||value.expires<=clock()||value.context!==context)return false;nonces.delete(key);return true;},
    async ping(){},async close(){otp.clear();nonces.clear();limits.clear();},
  };
  const mailer:OtpMailer={async sendCode(email,code){if(failMail)throw new Error('SECRET_SMTP_ERROR');delivered.set(email.toLowerCase(),code);},async verify(){},close(){}};
  return {challenges,mailer,delivered,failDelivery(value:boolean){failMail=value;}};
}

const fixtures=new WeakMap<ReturnType<typeof buildApp>,ReturnType<typeof authFixture>>();
export function buildTestApp(...args:Parameters<typeof buildApp>){
  if(args[0].nodeEnv!=='test')throw new Error('Auth fixtures are test-only');
  const fixture=authFixture();const app=buildApp(args[0],args[1],{...args[2],auth:{...fixture,...args[2]?.auth}});
  fixtures.set(app,fixture);app.addHook('onClose',async()=>fixture.challenges.close());return app;
}
export async function completeRegistration(app:ReturnType<typeof buildApp>,payload:{email:string;password:string;display_name:string}){
  const pending=await app.inject({method:'POST',url:'/v1/auth/register',payload});
  assert.equal(pending.statusCode,202,pending.body);
  const code=fixtures.get(app)?.delivered.get(payload.email.toLowerCase());assert.ok(code,'Test mail sink must receive a code');
  return app.inject({method:'POST',url:'/v1/auth/register/verify',payload:{email:payload.email,challenge_id:pending.json().challenge_id,code}});
}
