import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { buildTestApp, completeRegistration } from '../tests/support/auth.js';
import { loadConfig } from '../src/config.js';
import { createDatabase, type Database } from '../src/database/index.js';
import { cloudinaryStorage } from '../src/adapters/cloudinary.js';
import type { MediaRow } from '../src/modules/media/types.js';
import { logger } from '../src/logger.js';

const config=loadConfig();
if(config.nodeEnv==='production'||!config.cloudinary)throw new Error('Use development with Cloudinary configured');
const name=`padicheck_media_test_${randomBytes(8).toString('hex')}`;
if(!/^padicheck_media_test_[a-f0-9]{16}$/.test(name))throw new Error('Unsafe scratch database name');
const base=new URL(config.databaseUrl);const adminUrl=new URL(base);adminUrl.pathname='/postgres';
const admin=new pg.Pool({connectionString:adminUrl.toString(),connectionTimeoutMillis:5000});
const provider=cloudinaryStorage(config.cloudinary);
const storage={...provider,async upload(data:Buffer,spec:Parameters<typeof provider.upload>[1]){
  try{const result=await provider.upload(data,spec) as {bytes?:number;resource_type?:string;type?:string;public_id?:string;version?:number;asset_id?:string};
    logger.info({input_bytes:data.length,stored_bytes:result.bytes,resource_type:result.resource_type,delivery_type:result.type,
      public_id_matches:result.public_id===spec.publicId,has_asset_id:Boolean(result.asset_id),version_valid:Number.isSafeInteger(result.version)},'Cloudinary smoke upload metadata');return result;
  }catch(error){const failure=error as {http_code?:number;message?:string};const message=failure.message??'';
    logger.error({http_status:failure.http_code,reason:/signature|api.?key|credential/i.test(message)?'credentials':/image|png|decode/i.test(message)?'image_content':/timeout|network|connect/i.test(message)?'network':'other'},'Cloudinary smoke upload rejected');throw new Error('Cloudinary smoke upload failed');}
}};
let db:Database|undefined;let app:ReturnType<typeof buildTestApp>|undefined;let created=false;let cleaned=true;
let stage='database_setup';
try{
  await admin.query(`CREATE DATABASE "${name}"`);created=true;
  base.pathname='/'+name;db=createDatabase(base.toString());
  await db.query(await readFile(new URL('../db/migrations/001_baseline.sql',import.meta.url),'utf8'));
  await db.query(await readFile(new URL('../db/migrations/004_platform_foundation.sql',import.meta.url),'utf8'));
  app=buildTestApp({...config,nodeEnv:'test',logLevel:'silent',redisUrl:undefined,billingEnabled:false,researchEnabled:false},db,{storage});
  stage='signup';
  const registration=await completeRegistration(app,{display_name:'Cloudinary smoke',email:'cloudinary-smoke@example.invalid',password:'Cloudinary smoke password 123!'});
  assert.equal(registration.statusCode,201);const headers={authorization:`Bearer ${registration.json().access_token}`};
  // Generate a valid one-pixel fixture, including CRCs (not just a PNG signature).
  const chunk=(kind:string,data:Buffer)=>{
    const type=Buffer.from(kind);const crcInput=Buffer.concat([type,data]);let crc=0xffffffff;
    for(const byte of crcInput){crc^=byte;for(let bit=0;bit<8;bit++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}
    const length=Buffer.alloc(4);length.writeUInt32BE(data.length);const checksum=Buffer.alloc(4);checksum.writeUInt32BE((crc^0xffffffff)>>>0);
    return Buffer.concat([length,type,data,checksum]);
  };
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(1,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=6;
  const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.from([0,255,0,0,255]))),chunk('IEND',Buffer.alloc(0))]);
  const boundary='padicheck-cloudinary-smoke';
  const payload=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="smoke.png"\r\nContent-Type: image/png\r\n\r\n`),png,Buffer.from(`\r\n--${boundary}--\r\n`)]);
  stage='upload';
  const upload=await app.inject({method:'POST',url:'/v1/media',headers:{...headers,'content-type':`multipart/form-data; boundary=${boundary}`},payload});
  logger.info({status:upload.statusCode,error_code:upload.statusCode>=400?upload.json().error?.code:undefined},'Cloudinary backend upload response');
  assert.equal(upload.statusCode,201,'Cloudinary backend upload failed');
  const media=upload.json().media as MediaRow;
  assert.equal(media.provider_delivery_type,'authenticated');assert.equal(media.visibility,'private');assert.equal(media.upload_status,'ready');assert.ok(media.provider_asset_id);
  stage='delivery_authorization';
  const unauthenticated=await app.inject({method:'POST',url:`/v1/media/${media.media_id}/delivery`});assert.equal(unauthenticated.statusCode,401);
  stage='delivery_url';
  const delivery=await app.inject({method:'POST',url:`/v1/media/${media.media_id}/delivery`,headers});assert.equal(delivery.statusCode,200);
  stage='signed_download';
  const signed=await fetch(delivery.json().url,{signal:AbortSignal.timeout(15000),redirect:'error'});
  assert.equal(signed.status,200,'Signed Cloudinary download failed');assert.ok((await signed.arrayBuffer()).byteLength>0);
  stage='unsigned_download';
  const unsigned=await fetch(`https://res.cloudinary.com/${config.cloudinary.cloudName}/image/authenticated/${media.provider_public_id}.png`,{signal:AbortSignal.timeout(15000),redirect:'error'});
  assert.notEqual(unsigned.status,200,'Private original must not be publicly readable');
  stage='cleanup';
  assert.equal((await app.inject({method:'DELETE',url:`/v1/media/${media.media_id}`,headers})).statusCode,204);
  logger.info({passed:true,upload_status:201,signed_download_status:signed.status,unsigned_download_status:unsigned.status,cleanup_status:204},'Cloudinary private upload acceptance passed');
}catch{logger.error({stage},'Cloudinary smoke failed; no credentials or signed URLs logged');process.exitCode=1;}
finally{
  if(db){
    const assets=await db.query<MediaRow>("SELECT * FROM media_files WHERE upload_status<>'deleted'");
    for(const asset of assets.rows){try{await storage.destroy(asset.provider_public_id,asset.provider_resource_type);}catch{cleaned=false;logger.error({media_id:asset.media_id},'Cloudinary smoke cleanup needs retry; scratch database retained');}}
  }
  await app?.close();await db?.close();
  if(created&&cleaned)await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  if(!cleaned)process.exitCode=1;
  await admin.end();
}
