import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createDatabase, type Database } from '../src/database/index.js';
import { createInvestigation } from '../src/modules/investigations/service.js';
import { consumeUnit } from '../src/modules/billing/service.js';
import { logger } from '../src/logger.js';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const base=new URL(process.env.DATABASE_URL),adminUrl=new URL(base);adminUrl.pathname='/postgres';
const name=`padicheck_billing_test_${randomBytes(8).toString('hex')}`;
if(!/^padicheck_billing_test_[a-f0-9]{16}$/.test(name))throw new Error('Unsafe scratch database name');
const admin=new pg.Pool({connectionString:adminUrl.toString(),connectionTimeoutMillis:5000});let created=false;let db:Database|undefined;
try{
  await admin.query(`CREATE DATABASE "${name}"`);created=true;
  const url=new URL(base);url.pathname='/'+name;db=createDatabase(url.toString());
  await db.query(await readFile(new URL('../db/migrations/001_baseline.sql',import.meta.url),'utf8'));
  await db.query(await readFile(new URL('../db/migrations/003_billing.sql',import.meta.url),'utf8'));
  const user=(await db.query("INSERT INTO users (display_name,email) VALUES ('Billing smoke','billing-smoke@example.test') RETURNING users_id")).rows[0]!.users_id;
  const offer=(await db.query(`INSERT INTO billing_offers (environment,offer_key,display_name,billing_mode,provider_product_id,currency,amount,investigation_units)
    VALUES ('sandbox','smoke','Smoke','one_time','prod_smoke','USD',1,1) RETURNING *`)).rows[0]!;
  const checkout=(await db.query(`INSERT INTO billing_checkouts (users_id,environment,offer_id,request_key,request_fingerprint,offer_snapshot)
    VALUES ($1,'sandbox',$2,gen_random_uuid(),$3,$4::jsonb) RETURNING billing_checkout_id`,[user,offer.offer_id,'0'.repeat(64),JSON.stringify(offer)])).rows[0]!.billing_checkout_id;
  await db.query(`INSERT INTO billing_grants (users_id,environment,billing_checkout_id,source_type,provider_source_id,units_granted,valid_from)
    VALUES ($1,'sandbox',$2,'checkout','chk_smoke',1,now())`,[user,checkout]);
  const database=db;
  let arrivals=0;let release!:()=>void;const inserted=new Promise<void>(resolve=>{release=resolve;});
  const results=await Promise.allSettled([1,2].map(()=>createInvestigation(database,user,
    {investigation_type:'general_research',user_prompt:'Concurrent allowance smoke test'},async(client,owner,id)=>{
      arrivals++;if(arrivals===2)release();await inserted;await consumeUnit(client,owner,id,'sandbox');
    })));
  assert.equal(results.filter(value=>value.status==='fulfilled').length,1);
  assert.equal(results.filter(value=>value.status==='rejected'&&(value.reason as {code?:string}).code==='payment_required').length,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM investigations')).rows[0]!.n,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_usage')).rows[0]!.n,1);
  assert.equal((await db.query('SELECT units_used FROM billing_grants')).rows[0]!.units_used,1);
  logger.info('Real PostgreSQL billing migration and concurrent last-unit consumption passed; no provider called');
}catch(error){logger.error({err:error},'Billing smoke failed');process.exitCode=1;}
finally{if(db)await db.close();try{if(created)await admin.query(`DROP DATABASE "${name}"`);}finally{await admin.end();}}
