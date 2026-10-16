import 'dotenv/config';
import { logger as rootLogger } from '../src/logger.js';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createDatabase, type Database } from '../src/database/index.js';
import { buildTestApp as buildApp, completeRegistration } from '../tests/support/auth.js';
import { loadConfig } from '../src/config.js';
const logger = rootLogger.child({ component: 'smoke-sharing' });


if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const base = new URL(process.env.DATABASE_URL);
const adminUrl = new URL(base); adminUrl.pathname = '/postgres';
const name = `padicheck_sharing_test_${randomBytes(8).toString('hex')}`;
if (!/^padicheck_sharing_test_[a-f0-9]{16}$/.test(name)) throw new Error('Unsafe scratch database name');
const admin = new pg.Pool({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 });
let created = false; let db: Database | undefined; let app: ReturnType<typeof buildApp> | undefined;
try {
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  const scratchUrl = new URL(base); scratchUrl.pathname = '/' + name;
  db = createDatabase(scratchUrl.toString());
  await db.query(await readFile(new URL('../db/migrations/001_baseline.sql', import.meta.url), 'utf8'));
  app = buildApp(loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: scratchUrl.toString(), JWT_SECRET: randomBytes(32).toString('hex') }), db);
  const api = app; const scratch = db;
  const registered = await completeRegistration(api,{display_name:'Sharing smoke',email:'sharing@example.test',password:'Sharing smoke password long enough'});
  assert.equal(registered.statusCode,201);
  const owner = registered.json().user.users_id;
  const headers = {authorization:`Bearer ${registered.json().access_token}`};
  const inv = (await scratch.query(`INSERT INTO investigations (user_id,investigation_type,user_prompt,status,result_summary,completed_at)
    VALUES ($1,'general_research','Private smoke prompt','completed','Unverified result summary',now()) RETURNING investigation_id`,[owner])).rows[0]!.investigation_id;
  const path = `/v1/investigations/${inv}/share-links`;
  for(let i=0;i<9;i++) await scratch.query(`INSERT INTO investigation_share_links (investigation_id,created_by_user_id,token_hash,expires_at)
    VALUES ($1,$2,$3,now()+interval '1 day')`,[inv,owner,randomBytes(32).toString('hex')]);
  const requests = await Promise.all([1,2].map(() => api.inject({method:'POST',url:path,headers,payload:{acknowledge_sensitive_content:true}})));
  assert.deepEqual(requests.map(r=>r.statusCode).sort(),[201,409]);
  const issued = requests.find(r=>r.statusCode===201)!.json();
  assert.equal(Number((await scratch.query('SELECT count(*) FROM investigation_share_links WHERE investigation_id = $1',[inv])).rows[0]!.count),10);
  const resolve = () => api.inject({method:'POST',url:'/v1/shared-investigations/resolve',payload:{token:issued.token}});
  assert.equal((await resolve()).statusCode,200);
  async function waitForLock(prefix: string) {
    const deadline = Date.now()+5000;
    while(Date.now()<deadline) {
      const waiting = await scratch.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND state='active'
        AND wait_event_type='Lock' AND query LIKE $1`,[prefix+'%']);
      if(waiting.rowCount) return;
      await new Promise(done=>setTimeout(done,25));
    }
    throw new Error('Expected lock wait was not observed');
  }
  // Queue revoke ahead of redemption behind a real independent session lock.
  // A joined lock-order regression would expose stale data or deadlock here.
  type Response = Awaited<ReturnType<typeof resolve>>;
  let revocation: Promise<Response> | undefined;
  let redemption: Promise<Response> | undefined;
  await scratch.session(async blocker => {
    await blocker.query('BEGIN');
    try {
      await blocker.query('SELECT investigation_id FROM investigations WHERE investigation_id = $1 FOR UPDATE',[inv]);
      // LightMyRequest thenables start when observed; turn these into live promises.
      revocation = Promise.resolve(api.inject({method:'POST',url:`${path}/${issued.share.share_link_id}/revoke`,headers}));
      await waitForLock('SELECT investigation_id,status FROM investigations');
      redemption = Promise.resolve(resolve());
      await waitForLock('SELECT i.investigation_id FROM investigations i JOIN users');
      await blocker.query('COMMIT');
    } catch(error) { await blocker.query('ROLLBACK'); throw error; }
  });
  assert.equal((await revocation!).statusCode,200);
  assert.equal((await redemption!).statusCode,404);
  assert.equal((await resolve()).statusCode,404);
  logger.info('Live PostgreSQL sharing, concurrent active-link cap, queued revocation and blocked redemption passed. No external provider calls.');
} catch(error) {
  logger.error({ err: error }, 'Sharing smoke failed:'); process.exitCode=1;
} finally {
  if(app) await app.close();
  if(db) await db.close();
  try {if(created){await admin.query(`DROP DATABASE "${name}"`);logger.info('Removed the generated sharing smoke database.');}}
  finally {await admin.end();}
}
