import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import type { GoogleVerifier } from '../modules/auth/identity-types.js';
import { ApiError } from '../errors.js';

export function googleIdentity(clientId:string, verifyToken?:(token:string,audience:string)=>Promise<TokenPayload|undefined>): GoogleVerifier {
  const client=new OAuth2Client({clientId,transporterOptions:{timeout:10000,retry:false}});
  const verify=verifyToken??(async(token,audience)=>(await client.verifyIdToken({idToken:token,audience})).getPayload());
  return {async verify(idToken){
    try{
      const value=await verify(idToken,clientId);
      const nonce=(value as unknown as {nonce?:unknown})?.nonce;
      if(!value||!value.sub||value.sub.length>255||!value.email||value.email.length>254||value.email_verified!==true||
        typeof nonce!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(nonce)||
        !['accounts.google.com','https://accounts.google.com'].includes(value.iss)||value.aud!==clientId||value.exp*1000<=Date.now())throw new Error();
      return {sub:value.sub,email:value.email.trim().toLowerCase(),name:(value.name??'PadiCheck user').trim().slice(0,120)||'PadiCheck user',nonce,
        authoritative_email:value.email.toLowerCase().endsWith('@gmail.com')||Boolean(value.hd)};
    }catch{throw new ApiError(401,'invalid_google_token','Google sign-in could not be verified');}
  }};
}
