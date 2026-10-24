import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../src/database/index.js';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const db=createDatabase(process.env.DATABASE_URL);
try{await db.session(async client=>{
 await client.query('SELECT pg_advisory_lock($1)',[721934206]);
 try{const exists=(await client.query("SELECT to_regclass('public.credit_policies') AS name")).rows[0]?.name;
 if(!exists)await client.query(await readFile(new URL('../db/migrations/006_credits.sql',import.meta.url),'utf8'));
 }finally{await client.query('SELECT pg_advisory_unlock($1)',[721934206]);}
});console.log('Credit policy migration ready');}catch{console.error('Credit migration failed');process.exitCode=1;}finally{await db.close();}
