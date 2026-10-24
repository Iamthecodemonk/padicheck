import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../src/database/index.js';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
const db=createDatabase(process.env.DATABASE_URL);
try{await db.session(async client=>{await client.query('SELECT pg_advisory_lock($1)',[721934208]);try{await client.query(await readFile(new URL('../db/migrations/007_browser_sessions.sql',import.meta.url),'utf8'));}finally{await client.query('SELECT pg_advisory_unlock($1)',[721934208]);}});console.log('Browser session migration ready');}catch{console.error('Browser session migration failed');process.exitCode=1;}finally{await db.close();}
