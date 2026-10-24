import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createDatabase,type Database,type SqlExecutor} from '../src/database/index.js';
import {createInvestigation} from '../src/modules/investigations/service.js';
import {consumeCredits} from '../src/modules/billing/credits.js';

// Uses an isolated, random schema. Never inserts into production user tables.
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const schema='credit_test_'+randomBytes(8).toString('hex');
if(!/^credit_test_[0-9a-f]{16}$/.test(schema))throw new Error('Unsafe test schema');
const db=createDatabase(process.env.DATABASE_URL);
async function transaction<T>(work:(client:SqlExecutor)=>Promise<T>){return db.session(async client=>{
 await client.query('BEGIN');try{await client.query(`SET LOCAL search_path TO "${schema}",public`);const value=await work(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}
});}
const isolated:Database={query:(sql,values)=>transaction(client=>client.query(sql,values)),transaction,session:transaction,close:async()=>{}};
let created=false;
try{
 await db.query(`CREATE SCHEMA "${schema}"`);created=true;
 for(const table of ['users','investigations','billing_subscriptions','billing_grants','billing_usage','credit_policies','credit_charges'])await db.query(`CREATE TABLE "${schema}".${table} (LIKE public.${table} INCLUDING ALL)`);
 await db.query(`ALTER TABLE "${schema}".investigations ADD FOREIGN KEY(user_id) REFERENCES "${schema}".users(users_id)`);
 const user=(await isolated.query("INSERT INTO users(display_name,email) VALUES('Isolated credit test','isolated@example.test') RETURNING users_id")).rows[0]!.users_id;
 await isolated.query(`INSERT INTO credit_policies(environment,welcome_credits,costs) VALUES('sandbox',0,'{"general_research":4}')`);
 await isolated.query("INSERT INTO billing_grants(users_id,environment,source_type,provider_source_id,units_granted,valid_from) VALUES($1,'sandbox','welcome','concurrency-test',5,now())",[user]);
 const run=()=>createInvestigation(isolated,user,{investigation_type:'general_research',user_prompt:'Isolated concurrent credit test',expected_credit_cost:4},(client,userId,id,input)=>consumeCredits(client,userId,id,'sandbox',input));
 const results=await Promise.allSettled([run(),run()]);
 assert.equal(results.filter(value=>value.status==='fulfilled').length,1);
 const failure=results.find(value=>value.status==='rejected');assert.ok(failure&&failure.status==='rejected');assert.equal(failure.reason.code,'insufficient_credits');
 assert.equal(Number((await isolated.query('SELECT count(*) FROM investigations')).rows[0]!.count),1);
 assert.equal((await isolated.query('SELECT units_used FROM billing_grants')).rows[0]!.units_used,4);
 assert.equal(Number((await isolated.query('SELECT count(*) FROM credit_charges')).rows[0]!.count),1);
 console.log('Concurrent PostgreSQL credit test passed: one accepted, one rejected; no overspend or orphan investigation');
}catch(error){console.error('Concurrent credit test failed',error instanceof assert.AssertionError?error.message:(error as {code?:string}).code??'unknown');process.exitCode=1;}
finally{if(created)await db.query(`DROP SCHEMA "${schema}" CASCADE`);await db.close();}
