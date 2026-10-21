import type { AppConfig } from '../config.js';
import { ApiError } from '../errors.js';
import type { BillingProvider, Json } from '../modules/billing/types.js';

export function bachsProvider(config: NonNullable<AppConfig['bachs']>, transport: typeof fetch = fetch): BillingProvider {
  const base=config.environment==='sandbox'?'https://sandbox-api.bachs.io':'https://api.bachs.io';
  const id=(value:string,prefix:string)=>{if(!new RegExp(`^${prefix}_[a-zA-Z0-9_-]{1,200}$`).test(value))throw new ApiError(502,'invalid_billing_response','Invalid provider identifier');return encodeURIComponent(value);};
  async function call(path:string,method='GET',body?:Json,key?:string):Promise<Json>{
    try {
      const response=await transport(base+path,{method,redirect:'error',signal:AbortSignal.timeout(8000),
        headers:{Authorization:`Bearer ${config.apiKey}`,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},
        body:body?JSON.stringify(body):undefined});
      if(!response.ok){await response.body?.cancel();throw new Error();}
      const reader=response.body?.getReader();if(!reader)throw new Error();
      const parts:Uint8Array[]=[];let size=0;
      try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024)throw new Error();parts.push(value);}}
      finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
      const result=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!result||typeof result!=='object'||Array.isArray(result))throw new Error();
      return result;
    }catch{throw new ApiError(502,'billing_provider_failed','The payment provider request could not be completed');}
  }
  return {createCheckout:(input,key)=>call('/v1/checkout-sessions','POST',input,key),
    checkout:value=>call(`/v1/checkout-sessions/${id(value,'chk')}`),subscription:value=>call(`/v1/subscriptions/${id(value,'sub')}`),
    portal:value=>call(`/v1/customers/${id(value,'cust')}/portal-sessions`,'POST')};
}

export function providerUrl(value:unknown,environment:string,kind:'checkout'|'portal'):string {
  try{const url=new URL(String(value));const hosts=kind==='checkout'?['checkout.bachs.io','sandbox-checkout.bachs.io']:['portal.bachs.io','sandbox-portal.bachs.io'];
    if(url.protocol!=='https:'||url.username||url.password||url.port||!hosts.includes(url.hostname)||environment==='production'&&url.hostname.startsWith('sandbox-'))throw new Error();
    return url.href;
  }catch{throw new ApiError(502,'invalid_billing_response','Invalid provider URL');}
}
