import 'dotenv/config';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createLogger } from '../src/logger.js';

// Interactive local acceptance test. Never registered by the production server.
const logger = createLogger('google-acceptance', 'info');
logger.info('Loading local Google test configuration');
const config = loadConfig();
if (config.nodeEnv === 'production' || !config.googleClientId || !config.redisUrl) {
  throw new Error('Use development configuration with GOOGLE_CLIENT_ID and REDIS_URL');
}
const app = buildApp({ ...config, logLevel: 'silent' });
const origin = 'http://localhost:3000';
const capability = randomBytes(32).toString('hex');
const safeJson = (value: string) => JSON.stringify(value).replaceAll('<', '\\u003c');

app.register(async local => {
  local.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer')
      .header('X-Content-Type-Options', 'nosniff');
    if (request.headers.host !== 'localhost:3000') return reply.code(403).send({ error: 'Use localhost:3000' });
    if (request.method === 'POST') {
      const supplied = request.headers['x-padicheck-test'];
      if (request.headers.origin !== origin || typeof supplied !== 'string' ||
        Buffer.byteLength(supplied) !== Buffer.byteLength(capability) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(capability))) {
        return reply.code(403).send({ error: 'Local test authorization required' });
      }
    }
  });
  local.get('/', async (_request, reply) => reply.type('text/html').send(`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>PadiCheck Google sign-in test</title>
<style>body{font:17px system-ui;max-width:720px;margin:60px auto;padding:20px}pre{white-space:pre-wrap}button{padding:12px}</style>
<h1>PadiCheck Google sign-in test</h1>
<p>This uses your real Google account and local backend. A new PadiCheck account may be created.
The test checks account access, replay protection, and logout; the test session is then revoked.</p>
<button id="retry">Prepare sign-in / retry</button><div id="google"></div><pre id="status">Loading Google…</pre>
<script>
const status=document.getElementById('status');
async function post(path,body){const response=await fetch('/__google-test/'+path,{method:'POST',
headers:{'Content-Type':'application/json','X-PadiCheck-Test':${safeJson(capability)}},body:JSON.stringify(body)});
return {status:response.status,body:await response.json()};}
async function prepare(){try{document.getElementById('google').replaceChildren();
const challenge=await post('challenge',{});if(challenge.status!==200)throw Error('Challenge unavailable; check backend readiness.');
google.accounts.id.initialize({client_id:${safeJson(config.googleClientId!)},nonce:challenge.body.nonce,
callback:async response=>{status.textContent='Checking sign-in and session security…';try{
const result=await post('verify',{id_token:response.credential});status.textContent=JSON.stringify(result.body,null,2);
}catch{status.textContent='Request failed. Prepare a fresh sign-in and retry.';}}});
google.accounts.id.renderButton(document.getElementById('google'),{theme:'outline',size:'large'});
status.textContent='Click Sign in with Google. Challenges expire after five minutes.';
}catch(error){status.textContent=error.message||'Google could not load.';}}
document.getElementById('retry').onclick=prepare;
</script><script src="https://accounts.google.com/gsi/client" async defer onload="prepare()"
onerror="document.getElementById('status').textContent='Google script could not load.'"></script></html>`));

  local.post('/challenge', async (_request, reply) => {
    const result = await app.inject({ method: 'POST', url: '/v1/auth/google/challenge', payload: { action: 'login' } });
    return reply.code(result.statusCode).type('application/json').send(result.body);
  });
  local.post<{ Body: { id_token: string } }>('/verify', {
    bodyLimit: 16384,
    schema: { body: { type: 'object', additionalProperties: false, required: ['id_token'],
      properties: { id_token: { type: 'string', minLength: 1, maxLength: 12000 } } } },
  }, async (request, reply) => {
    const login = await app.inject({ method: 'POST', url: '/v1/auth/google', payload: request.body });
    if (login.statusCode !== 200) {
      const code = login.json<{ error?: { code?: string } }>().error?.code ?? 'signin_failed';
      logger.info({ status: login.statusCode, failure_code: code }, 'Google acceptance sign-in failed');
      return reply.code(login.statusCode).send({ passed: false, login_status: login.statusCode, error: code,
        ...(code === 'account_link_required' ? { next_step: 'Sign in to your existing password account and explicitly link Google.' } : {}) });
    }
    const session = login.json<{ access_token: string }>();
    const headers = { authorization: `Bearer ${session.access_token}` };
    let accountStatus = 0;
    let replayStatus = 0;
    let replayRejected = false;
    let logoutStatus = 0;
    // Always attempt to revoke the session, even if another check fails.
    try {
      accountStatus = (await app.inject({ method: 'GET', url: '/v1/auth/me', headers })).statusCode;
      const replay = await app.inject({ method: 'POST', url: '/v1/auth/google', payload: request.body });
      replayStatus = replay.statusCode;
      replayRejected = replayStatus === 401 && replay.json().error?.code === 'invalid_google_challenge';
    } finally {
      logoutStatus = (await app.inject({ method: 'POST', url: '/v1/auth/logout', headers })).statusCode;
    }
    const revokedStatus = (await app.inject({ method: 'GET', url: '/v1/auth/me', headers })).statusCode;
    const report = { passed: accountStatus === 200 && replayRejected && logoutStatus === 204 && revokedStatus === 401,
      login_status: login.statusCode, account_status: accountStatus, replay_status: replayStatus,
      replay_rejected: replayRejected, logout_status: logoutStatus, revoked_session_status: revokedStatus };
    logger.info(report, 'Google acceptance test completed');
    return report;
  });
}, { prefix: '/__google-test' });

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  clearTimeout(expiry);
  await app.close();
}
const expiry = setTimeout(() => { void stop(); }, 15 * 60 * 1000);
process.once('SIGINT', () => { void stop(); });
process.once('SIGTERM', () => { void stop(); });
try {
  await app.listen({ host: '127.0.0.1', port: 3000 });
  logger.info({ url: `${origin}/__google-test/`, expires_in_minutes: 15 }, 'Open the local Google acceptance test');
} catch {
  logger.error('Could not start local test on port 3000; check whether another server is using it');
  await stop();
  process.exitCode = 1;
}
