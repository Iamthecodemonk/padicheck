import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { logger } from '../src/logger.js';
import { billingTables } from '../src/modules/billing/service.js';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
let client:pg.PoolClient|undefined;let locked=false;
try{
  client=await pool.connect();
  await client.query("SET lock_timeout='5s'");await client.query("SET statement_timeout='30s'");
  await client.query('SELECT pg_advisory_lock($1)',[721934201]);locked=true;
  const installed=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1::text[])",[billingTables]);
  if(installed.rowCount===billingTables.length){logger.info('Billing tables already exist; run db:verify to validate their definitions.');}
  else{
    if(installed.rowCount)throw new Error('Partial billing schema detected; refusing to overwrite tables');
    const foundation=await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','investigations')");
    if(foundation.rowCount!==2)throw new Error('Apply the baseline before billing');
    await client.query(await readFile(new URL('../db/migrations/003_billing.sql',import.meta.url),'utf8'));
    logger.info('Applied approved 003 billing migration; billing remains disabled until configured.');
  }
}catch{if(client)await client.query('ROLLBACK');logger.error('Billing migration failed; verify foundation and partial-schema state');process.exitCode=1;}
finally{if(client){if(locked)await client.query('SELECT pg_advisory_unlock($1)',[721934201]);client.release();}await pool.end();}
