import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../../errors.js';
import type { Json } from './types.js';

export function verifyWebhook(raw:Buffer,headers:Record<string,string|string[]|undefined>,secret:string,now=Date.now()):Json {
  const fail=()=>new ApiError(400,'invalid_webhook','Invalid payment webhook');
  const v2=headers['x-bachs-signature-v2'];let timestamp: string|undefined;let signatures:string[]=[];
  if(v2!==undefined){
    if(typeof v2!=='string'||v2.length>2048)throw fail();
    const parts=v2.split(',').map(part=>part.trim().split('='));
    const times=parts.filter(([key])=>key==='t');if(times.length!==1)throw fail();timestamp=times[0]?.[1];
    signatures=parts.filter(([key])=>key==='v1').map(([,value])=>value??'');
  }else{
    const t=headers['x-bachs-timestamp'];const s=headers['x-bachs-signature'];
    if(typeof t!=='string'||typeof s!=='string')throw fail();timestamp=t;signatures=[s];
  }
  if(!timestamp||!/^\d{1,12}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)throw fail();
  const expected=createHmac('sha256',secret).update(timestamp+'.').update(raw).digest();
  if(!signatures.some(value=>/^[0-9a-f]{64}$/i.test(value)&&timingSafeEqual(expected,Buffer.from(value,'hex'))))throw fail();
  try{const value=JSON.parse(raw.toString('utf8'));if(!value||Array.isArray(value)||typeof value!=='object')throw fail();return value;}
  catch{throw fail();}
}

export function money(value:unknown):bigint {
  if(typeof value!=='string'||!/^\d{1,12}(\.\d{1,6})?$/.test(value))throw new ApiError(409,'billing_mismatch','Payment amount or currency does not match the offer');
  const [whole,fraction='']=value.split('.');return BigInt(whole!)*1000000n+BigInt(fraction.padEnd(6,'0'));
}
export function sameMoney(a:unknown,b:unknown){return money(a)===money(b);}
export function currencyAmount(value:string):string {
  const scaled=money(value);if(scaled%10000n!==0n)throw new ApiError(409,'billing_mismatch','Unsupported currency precision');
  return `${scaled/1000000n}.${String((scaled%1000000n)/10000n).padStart(2,'0')}`;
}
export function date(value:unknown):string {
  if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw new ApiError(409,'billing_mismatch','Invalid provider billing period');
  return new Date(value).toISOString();
}
