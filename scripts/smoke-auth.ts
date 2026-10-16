import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { buildTestApp } from '../tests/support/auth.js';
import { loadConfig } from '../src/config.js';
import { createDatabase, type Database } from '../src/database/index.js';
import { redisAuthChallenges } from '../src/adapters/auth-challenges.js';
import { authFixture } from '../tests/support/auth.js';
import { logger as rootLogger } from '../src/logger.js';
import type { AuthChallenges } from '../src/modules/auth/identity-types.js';

const logger=rootLogger.child({component:'auth-smoke'});
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const useRedis=process.argv.slice(2).includes('--redis');
if(process.argv.slice(2).some(arg=>arg!=='--redis')||(useRedis&&!process.env.REDIS_URL))throw new Error('Use --redis only with configured REDIS_URL');
const base=new URL(process.env.DATABASE_URL);const adminUrl=new URL(base);adminUrl.pathname='/postgres';
const name=`padicheck_auth_test_${randomBytes(8).toString('hex')}`;
if(!/^padicheck_auth_test_[a-f0-9]{16}$/.test(name))throw new Error('Unsafe scratch database name');
const admin=new pg.Pool({connectionString:adminUrl.toString(),connectionTimeoutMillis:5000});
let created=false;let db:Database|undefined;let app:ReturnType<typeof buildTestApp>|undefined;let store:AuthChallenges|undefined;
try{
  await admin.query(`CREATE DATABASE "${name}"`);created=true;
  const scratchUrl=new URL(base);scratchUrl.pathname='/'+name;db=createDatabase(scratchUrl.toString());
  await db.query(await readFile(new URL('../db/migrations/001_baseline.sql',import.meta.url),'utf8'));
  const fixture=authFixture();store=useRedis?redisAuthChallenges(process.env.REDIS_URL!):fixture.challenges;
  app=buildTestApp(loadConfig({NODE_ENV:'test',LOG_LEVEL:'silent',DATABASE_URL:scratchUrl.toString(),JWT_SECRET:randomBytes(32).toString('hex')}),db,
    {auth:{challenges:store,mailer:fixture.mailer}});
  const email=`auth-${randomBytes(12).toString('hex')}@example.test`;const password='Auth smoke test password long enough';
  const pending=await app.inject({method:'POST',url:'/v1/auth/register',payload:{email,password,display_name:'Auth smoke'}});
  assert.equal(pending.statusCode,202,pending.body);assert.equal(Number((await db.query('SELECT count(*) FROM users')).rows[0]!.count),0);
  const payload={email,challenge_id:pending.json().challenge_id,code:fixture.delivered.get(email)!};
  const api=app;
  const concurrent=await Promise.all([1,2].map(()=>api.inject({method:'POST',url:'/v1/auth/register/verify',payload})));
  assert.deepEqual(concurrent.map(result=>result.statusCode).sort(),[201,400]);
  assert.equal(Number((await db.query('SELECT count(*) FROM users WHERE email_verified_at IS NOT NULL')).rows[0]!.count),1);
  const login=await app.inject({method:'POST',url:'/v1/auth/login',payload:{email,password}});assert.equal(login.statusCode,200,login.body);
  const me=await app.inject({url:'/v1/auth/me',headers:{authorization:`Bearer ${login.json().access_token}`}});
  assert.equal(me.json().user.email_verified,true);assert.deepEqual(me.json().user.roles,['user']);
  logger.info({challenge_store:useRedis?'redis':'test_double'},'Live PostgreSQL OTP signup, atomic consumption, verified password login and default role passed; no email sent');
}catch(error){logger.error({err:error},'Auth smoke failed');process.exitCode=1;}
finally{
  if(app)await app.close();if(store)await store.close();if(db)await db.close();
  try{if(created){await admin.query(`DROP DATABASE "${name}"`);logger.info('Removed generated auth smoke database');}}
  finally{await admin.end();}
}
