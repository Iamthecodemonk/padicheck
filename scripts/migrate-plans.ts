import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../src/database/index.js';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
const db=createDatabase(process.env.DATABASE_URL);
try{await db.session(async client=>{await client.query('SELECT pg_advisory_lock($1)',[721934209]);try{const row=(await client.query("SELECT to_regclass('public.billing_plans') AS name")).rows[0];if(!row?.name)await client.query(await readFile(new URL('../db/migrations/008_billing_plans.sql',import.meta.url),'utf8'));}finally{await client.query('SELECT pg_advisory_unlock($1)',[721934209]);}});console.log('Billing plan migration ready');}catch{console.error('Plan migration failed');process.exitCode=1;}finally{await db.close();}
