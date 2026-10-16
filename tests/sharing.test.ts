import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import Fastify from 'fastify';
import { Writable } from 'node:stream';
import { buildTestApp as buildApp, completeRegistration } from './support/auth.js';
import { loadConfig } from '../src/config.js';
import { testDatabase } from './support/database.js';
import { sharingRoutes } from '../src/modules/sharing/routes.js';
import { authorization } from '../src/modules/authorization/index.js';
import { memoryRevocations } from '../src/modules/auth/revocations.js';

const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: 'postgres://unused:unused@localhost/test', JWT_SECRET: 'test-secret-32-bytes-minimum-long-value' });

test('investigation sharing protects capabilities, evidence and owner control', async t => {
  const { db, postgres } = await testDatabase();
  const app = buildApp(config, db);
  async function actor(name: string, role?: string) {
    const result = await completeRegistration(app,{ email: `${name}@example.test`, display_name: name, password: 'Sharing test password long enough' });
    assert.equal(result.statusCode, 201);
    const id = result.json().user.users_id as string;
    if (role) await db.query('INSERT INTO user_roles (users_id,role_id) SELECT $1,role_id FROM roles WHERE role_key = $2', [id,role]);
    return { id, headers: { authorization: `Bearer ${result.json().access_token}` } };
  }
  const owner = await actor('shareowner'); const other = await actor('shareother'); const admin = await actor('shareadmin','admin');
  const inv = (await db.query(`INSERT INTO investigations (user_id,investigation_type,title,user_prompt,input_data,status,result_summary,completed_at)
    VALUES ($1,'contract_review','Result title','SECRET_PROMPT','{"media_ids":[]}', 'completed','Owner-authorized sensitive summary',now()) RETURNING investigation_id`, [owner.id])).rows[0]!.investigation_id as string;
  const base = `/v1/investigations/${inv}/share-links`;
  let issuingRequest = 0;
  const issue = (who = owner, payload: Record<string, unknown> = { acknowledge_sensitive_content: true }) => app.inject({ method: 'POST', url: base,
    remoteAddress: `192.0.2.${++issuingRequest}`, headers: who.headers, payload });
  const resolve = (token: string) => app.inject({ method: 'POST', url: '/v1/shared-investigations/resolve', payload: { token } });
  const revoke = (id: string, who = owner) => app.inject({ method: 'POST', url: `${base}/${id}/revoke`, headers: who.headers });
  const source = async (visibility: string, url: string, type = 'web_page') => {
    const row = (await db.query(`INSERT INTO sources (source_type,visibility,url,title,excerpt,metadata)
      VALUES ($1,$2,$3,'Evidence title','SECRET_EXCERPT','{"secret":"SECRET_METADATA"}') RETURNING source_id`, [type,visibility,url])).rows[0]!;
    await db.query('INSERT INTO investigation_sources (investigation_id,source_id) VALUES ($1,$2)', [inv,row.source_id]);
    return row.source_id as string;
  };
  const finding = (await db.query(`INSERT INTO findings (investigation_id,finding_type,category,title,explanation)
    VALUES ($1,'claim','review','A sourced claim','Owner-authorized finding text') RETURNING finding_id`, [inv])).rows[0]!.finding_id as string;
  const publicSource = await source('public','https://example.com/evidence');
  const privateSource = await source('private','https://example.com/private');
  const restrictedSource = await source('restricted','https://example.com/restricted');
  const signedSource = await source('public','https://example.com/document?signature=SECRET_QUERY');
  const unsafeSource = await source('public','http://127.0.0.1/internal');
  for (const id of [publicSource,privateSource,restrictedSource,signedSource,unsafeSource]) await db.query(`INSERT INTO finding_sources (finding_id,source_id,evidence_note) VALUES ($1,$2,$3)`,
    [finding,id,id === publicSource ? 'Public quotation' : 'SECRET_QUOTE']);
  const media = (await db.query(`INSERT INTO media_files (uploaded_by_user_id,provider_public_id,provider_resource_type,original_filename,
    media_type,mime_type,size_bytes,upload_status) VALUES ($1,'SECRET_CLOUDINARY_ID','raw','SECRET_FILENAME.pdf','document','application/pdf',100,'ready') RETURNING media_id`, [owner.id])).rows[0]!.media_id;
  const document = (await db.query("INSERT INTO sources (source_type,media_id,title,visibility) VALUES ('uploaded_document',$1,'SECRET_DOCUMENT','public') RETURNING source_id", [media])).rows[0]!.source_id;
  const foreign = (await db.query("INSERT INTO sources (source_type,url,visibility) VALUES ('web_page','https://example.com/foreign','public') RETURNING source_id")).rows[0]!.source_id;
  for (const sourceId of [document,foreign]) await db.query("INSERT INTO finding_sources (finding_id,source_id,evidence_note) VALUES ($1,$2,'SECRET_QUOTE')", [finding,sourceId]);
  let token: string; let shareId: string;
  try {
    await t.test('creation requires owner, authentication and explicit sensitive-content acknowledgment', async () => {
      assert.equal((await app.inject({ method: 'POST', url: base, payload: { acknowledge_sensitive_content: true } })).statusCode, 401);
      assert.equal((await issue(other)).statusCode, 404);
      assert.equal((await issue(admin)).statusCode, 404);
      assert.equal((await issue(owner, {})).statusCode, 400);
      assert.equal((await issue(owner, { acknowledge_sensitive_content: false })).statusCode, 400);
      assert.equal((await issue(owner, { acknowledge_sensitive_content: true, expires_at: null })).statusCode, 400);
      assert.equal((await issue(owner, { acknowledge_sensitive_content: true, ttl_seconds: 2592001 })).statusCode, 400);
      assert.equal((await issue(owner, { acknowledge_sensitive_content: true, ttl_seconds: 59 })).statusCode, 400);
    });
    await t.test('secrets are high entropy, returned once and stored only as hashes', async () => {
      const response = await issue(); assert.equal(response.statusCode, 201, response.body);
      token = response.json().token; shareId = response.json().share.share_link_id;
      assert.equal(Buffer.from(token,'base64url').length, 32);
      assert.equal(response.headers['cache-control'], 'no-store');
      const stored = (await db.query('SELECT * FROM investigation_share_links WHERE share_link_id = $1', [shareId])).rows[0]!;
      assert.equal(stored.token_hash, createHash('sha256').update(token).digest('hex'));
      assert.ok(!JSON.stringify(stored).includes(token));
      assert.equal(Math.round((new Date(stored.expires_at).getTime()-new Date(stored.created_at).getTime())/1000),604800);
      const listed = await app.inject({ url: base, headers: owner.headers });
      assert.equal(listed.statusCode, 200);
      assert.equal(listed.json().shares[0].token_hash, undefined);
      assert.ok(!listed.body.includes(token));
      const audit = await db.query('SELECT * FROM admin_audit_logs');
      assert.ok(!JSON.stringify(audit.rows).includes(token));
      assert.ok(!JSON.stringify(audit.rows).includes(stored.token_hash));
    });
    await t.test('bearer capability exposes a bounded result DTO without private source data or media access', async () => {
      const response = await resolve(token); assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.headers['cache-control'],'no-store'); assert.equal(response.headers['referrer-policy'],'no-referrer');
      assert.match(String(response.headers['x-robots-tag']), /noindex/);
      const data = response.json();
      assert.equal(data.investigation.result_summary,'Owner-authorized sensitive summary');
      assert.equal(data.findings[0].verification_status,'unverified');
      assert.equal(data.findings[0].sources.length,1);
      assert.equal(data.findings[0].sources[0].url,'https://example.com/evidence');
      assert.equal(data.findings[0].hidden_evidence_count,6);
      for (const forbidden of ['SECRET_',owner.id,'user_prompt','input_data','provider_public_id','media_id','token_hash','model_run_id','shareowner@example.test']) assert.ok(!response.body.includes(forbidden),forbidden);
      assert.equal((await app.inject({ url: `/v1/investigations/${inv}`, headers: { authorization: `Bearer ${token}` } })).statusCode,401);
      assert.equal((await app.inject({ method:'POST',url:'/v1/media/00000000-0000-4000-8000-000000000001/delivery',headers:{authorization:`Bearer ${token}`} })).statusCode,401);
    });
    await t.test('unknown, malformed, expired and revoked secrets reveal the same unavailable response', async () => {
      const notFound = await resolve(randomBytes(32).toString('base64url')); assert.equal(notFound.statusCode,404);
      for (const invalid of ['',token+'=',token.slice(1),'!'.repeat(43)]) assert.deepEqual((await resolve(invalid)).json().error,notFound.json().error);
      await db.query("UPDATE investigation_share_links SET expires_at = now()-interval '1 second' WHERE share_link_id = $1",[shareId]);
      assert.deepEqual((await resolve(token)).json().error,notFound.json().error);
      await db.query("UPDATE investigation_share_links SET expires_at = now()+interval '1 day' WHERE share_link_id = $1",[shareId]);
      assert.equal((await revoke(shareId,other)).statusCode,404);
      assert.equal((await revoke(shareId,admin)).statusCode,404);
      const response = await revoke(shareId); assert.equal(response.statusCode,200,response.body);
      assert.deepEqual((await resolve(token)).json().error,notFound.json().error);
      const auditCount = Number((await db.query("SELECT count(*) FROM admin_audit_logs WHERE action = 'investigations.share.revoke'")).rows[0]!.count);
      assert.equal((await revoke(shareId)).statusCode,200);
      assert.equal(Number((await db.query("SELECT count(*) FROM admin_audit_logs WHERE action = 'investigations.share.revoke'")).rows[0]!.count),auditCount);
    });
    await t.test('suspension, lost permissions, noncompleted state and invalid legacy expiration disable access', async () => {
      const fresh = await issue(); assert.equal(fresh.statusCode,201,fresh.body);
      token = fresh.json().token; shareId = fresh.json().share.share_link_id;
      await db.query("UPDATE users SET account_status = 'suspended' WHERE users_id = $1",[owner.id]);
      assert.equal((await resolve(token)).statusCode,404);
      await db.query("UPDATE users SET account_status = 'active' WHERE users_id = $1",[owner.id]);
      await db.query('DELETE FROM user_roles WHERE users_id = $1',[owner.id]);
      assert.equal((await resolve(token)).statusCode,404);
      // Revocation remains available when investigation permissions are removed.
      assert.equal((await revoke(shareId)).statusCode,200);
      await db.query("INSERT INTO user_roles (users_id,role_id) SELECT $1,role_id FROM roles WHERE role_key = 'user'",[owner.id]);
      const next = await issue(); token = next.json().token; shareId = next.json().share.share_link_id;
      await db.query("UPDATE investigations SET status = 'analyzing' WHERE investigation_id = $1",[inv]);
      assert.equal((await resolve(token)).statusCode,404); assert.equal((await issue()).statusCode,409);
      await db.query("UPDATE investigations SET status = 'completed' WHERE investigation_id = $1",[inv]);
      await db.query('UPDATE investigation_share_links SET expires_at = NULL WHERE share_link_id = $1',[shareId]);
      assert.equal((await resolve(token)).statusCode,404);
      await db.query("UPDATE investigation_share_links SET expires_at = created_at + interval '31 days' WHERE share_link_id = $1",[shareId]);
      assert.equal((await resolve(token)).statusCode,404);
      await revoke(shareId);
    });
    await t.test('audit failure rolls back both creation and revocation without storing a raw secret', async () => {
      const fresh = await issue(); shareId = fresh.json().share.share_link_id; token = fresh.json().token;
      const count = Number((await db.query('SELECT count(*) FROM investigation_share_links')).rows[0]!.count);
      await postgres.exec(`CREATE FUNCTION share_audit_failure() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test failure'; END; $$ LANGUAGE plpgsql;
        CREATE TRIGGER share_audit_failure BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION share_audit_failure();`);
      try {
        // This actor has a fresh per-IP budget for creation after earlier validation checks.
        const response = await app.inject({method:'POST',url:base,headers:owner.headers,remoteAddress:'198.51.100.9',payload:{acknowledge_sensitive_content:true}});
        assert.equal(response.statusCode,500,response.body);
        assert.equal((await revoke(shareId)).statusCode,500);
      } finally { await postgres.exec('DROP TRIGGER share_audit_failure ON admin_audit_logs; DROP FUNCTION share_audit_failure();'); }
      assert.equal(Number((await db.query('SELECT count(*) FROM investigation_share_links')).rows[0]!.count),count);
      assert.equal((await resolve(token)).statusCode,200);
    });
    await t.test('request logging contains neither supplied secrets nor returned result bodies', async () => {
      let logs = '';
      const loggerApp = Fastify({ logger: { level:'info', stream: new Writable({write(chunk,_encoding,done){logs+=chunk.toString();done();}}) } });
      const revocations = memoryRevocations();
      try {
        await sharingRoutes(loggerApp,db,authorization(loggerApp,db,revocations));
        const response = await loggerApp.inject({method:'POST',url:'/v1/shared-investigations/resolve',payload:{token}});
        assert.equal(response.statusCode,200,response.body);
        assert.ok(!logs.includes(token)); assert.ok(!logs.includes('Owner-authorized'));
      } finally { await loggerApp.close(); await revocations.close(); }
    });
    await t.test('active-link cap is enforced and revocation frees a slot', async () => {
      await db.query('DELETE FROM investigation_share_links WHERE investigation_id = $1',[inv]);
      for(let i=0;i<10;i++) await db.query(`INSERT INTO investigation_share_links (investigation_id,created_by_user_id,token_hash,expires_at)
        VALUES ($1,$2,$3,now()+interval '1 day')`,[inv,owner.id,randomBytes(32).toString('hex')]);
      const cap = await app.inject({method:'POST',url:base,headers:owner.headers,remoteAddress:'198.51.100.10',payload:{acknowledge_sensitive_content:true}});
      assert.equal(cap.statusCode,409,cap.body);
      const first = (await db.query('SELECT share_link_id FROM investigation_share_links LIMIT 1')).rows[0]!.share_link_id;
      await revoke(first);
      const fresh = await app.inject({method:'POST',url:base,headers:owner.headers,remoteAddress:'198.51.100.11',payload:{acknowledge_sensitive_content:true}});
      assert.equal(fresh.statusCode,201,fresh.body); token = fresh.json().token;
    });
    await t.test('shared findings are bounded and anonymous redemption is rate-limited', async () => {
      await db.query(`INSERT INTO findings (investigation_id,finding_type,category,title,explanation)
        SELECT $1,'claim','bound','Additional finding','Unverified' FROM generate_series(1,101)`,[inv]);
      const data = (await resolve(token)).json();
      assert.equal(data.findings.length,100); assert.equal(data.findings_truncated,true);
      for(let i=0;i<30;i++) assert.equal((await app.inject({method:'POST',url:'/v1/shared-investigations/resolve',remoteAddress:'198.51.100.20',payload:{token:'invalid'}})).statusCode,404);
      const limited = await app.inject({method:'POST',url:'/v1/shared-investigations/resolve',remoteAddress:'198.51.100.20',payload:{token:'invalid'}});
      assert.equal(limited.statusCode,429); assert.equal(limited.headers['cache-control'],'no-store');
    });
  } finally {await app.close();await db.close();}
});
