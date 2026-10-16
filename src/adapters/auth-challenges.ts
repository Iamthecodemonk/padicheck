import { createClient } from 'redis';
import { ApiError } from '../errors.js';
import type { AuthChallenges, PendingOtp } from '../modules/auth/identity-types.js';

// Keys for one email share a Redis hash tag. Limits survive resends and failed
// delivery; OTP verification and consumption happen together in one Lua call.
export const issueOtpLua = `
if redis.call('EXISTS',KEYS[2]) == 1 or tonumber(redis.call('GET',KEYS[3]) or '0') >= 5 then return 0 end
local count=redis.call('INCR',KEYS[3]); if count == 1 then redis.call('EXPIRE',KEYS[3],3600) end
redis.call('SET',KEYS[2],'1','EX',60)
redis.call('HSET',KEYS[1],'data',ARGV[1],'attempts',0)
redis.call('EXPIRE',KEYS[1],600)
return 1`;
export const consumeOtpLua = `
local data=redis.call('HGET',KEYS[1],'data'); if not data then return '' end
local value=cjson.decode(data)
if value.challenge_id ~= ARGV[1] or value.purpose ~= ARGV[3] then return '' end
local attempts=redis.call('HINCRBY',KEYS[1],'attempts',1)
if attempts > 5 then redis.call('DEL',KEYS[1]); return '' end
if value.code_digest ~= ARGV[2] then
  if attempts >= 5 then redis.call('DEL',KEYS[1]) end
  return ''
end
redis.call('DEL',KEYS[1]); return data`;
const discardLua = `local data=redis.call('HGET',KEYS[1],'data'); if data and cjson.decode(data).challenge_id == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0`;
const nonceLua = `if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end redis.call('DEL',KEYS[1]); return 1`;

export function redisAuthChallenges(url: string): AuthChallenges {
  const client = createClient({url,disableOfflineQueue:true,socket:{connectTimeout:3000,reconnectStrategy:false}});
  client.on('error',()=>{});
  let connecting: Promise<unknown> | undefined;
  async function run<T>(work:()=>Promise<T>):Promise<T>{
    try{
      if(!client.isReady){connecting??=client.connect().finally(()=>{connecting=undefined;});await connecting;}
      return await work();
    }catch{throw new ApiError(503,'auth_unavailable','Authentication challenges are unavailable');}
  }
  const otpKey=(key:string)=>`padicheck:auth:v1:{${key}}:otp`;
  const nonceKey=(key:string)=>`padicheck:auth:v1:nonce:${key}`;
  return {
    putOtp:(key,pending)=>run(async()=>Number(await client.eval(issueOtpLua,{keys:[otpKey(key),`${otpKey(key)}:cooldown`,`${otpKey(key)}:quota`],arguments:[JSON.stringify(pending)]}))===1),
    consumeOtp:(key,id,digest,purpose)=>run(async()=>{
      const value=await client.eval(consumeOtpLua,{keys:[otpKey(key)],arguments:[id,digest,purpose]});
      return typeof value==='string'&&value?JSON.parse(value) as PendingOtp:null;
    }),
    discardOtp:(key,id)=>run(async()=>{await client.eval(discardLua,{keys:[otpKey(key)],arguments:[id]});}),
    putNonce:(key,context)=>run(async()=>{await client.set(nonceKey(key),context,{EX:300,NX:true});}),
    consumeNonce:(key,context)=>run(async()=>Number(await client.eval(nonceLua,{keys:[nonceKey(key)],arguments:[context]}))===1),
    ping:()=>run(async()=>{await client.ping();}),
    async close(){if(client.isOpen)client.destroy();},
  };
}
