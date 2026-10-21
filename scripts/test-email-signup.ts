import 'dotenv/config';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDatabase } from '../src/database/index.js';
import { createLogger } from '../src/logger.js';

// Local interactive acceptance test only; never imported by the API server.
const logger = createLogger('email-acceptance', 'info');
const config = loadConfig();
if (config.nodeEnv === 'production' || !config.smtp || !config.redisUrl) {
  throw new Error('Use development configuration with SMTP and Redis configured');
}
const db = createDatabase(config.databaseUrl);
const app = buildApp({ ...config, logLevel: 'silent' }, db);
app.addHook('onClose', async () => { await db.close(); });
const capability = randomBytes(32).toString('hex');
let pending: { email: string; password: string; challenge_id: string; before_login_status: number } | undefined;
let busy = false;
const failure = (result: { statusCode: number; json(): { error?: { code?: string } } }) => {
  const report = { passed: false, status: result.statusCode, error: result.json().error?.code ?? 'request_failed' };
  logger.info(report, 'Email acceptance request failed');
  return report;
};

app.register(async local => {
  local.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer')
      .header('X-Content-Type-Options', 'nosniff');
    if (request.headers.host !== 'localhost:3000') return reply.code(403).send({ error: 'Use localhost:3000' });
    if (request.method === 'POST') {
      const supplied = request.headers['x-padicheck-test'];
      if (request.headers.origin !== 'http://localhost:3000' || typeof supplied !== 'string' ||
        Buffer.byteLength(supplied) !== Buffer.byteLength(capability) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(capability))) {
        return reply.code(403).send({ error: 'Local test authorization required' });
      }
    }
  });
  local.get('/', async (_request, reply) => reply.type('text/html').send(`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>PadiCheck email signup test</title>
<style>body{font:17px system-ui;max-width:700px;margin:40px auto;padding:20px}label{display:block;margin:12px 0}input,button{padding:10px}pre{white-space:pre-wrap}</style>
<h1>Email OTP signup test</h1>
<p>Use an email address you own that has no PadiCheck account. Your Google account email already exists;
a Gmail +alias can receive mail in the same inbox. Submitting sends a real email.
Verification creates a real account, tests password login, then revokes the test sessions.</p>
<form id="signup"><label>Name <input name="display_name" required maxlength="120" autocomplete="name"></label>
<label>Email <input name="email" type="email" required autocomplete="email"></label>
<label>New password <input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label>
<button>Send verification email</button></form>
<form id="verify" hidden><label>Code from your email <input name="code" required pattern="[0-9]{6}" maxlength="6" inputmode="numeric" autocomplete="one-time-code"></label><button>Verify and test</button></form>
<pre id="status">Enter your signup details. Keep your password and code out of chat.</pre>
<script>
const output=document.getElementById('status');
async function submit(form,path){const button=form.querySelector('button');button.disabled=true;
try{const response=await fetch('/__email-test/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-PadiCheck-Test':${JSON.stringify(capability)}},
body:JSON.stringify(Object.fromEntries(new FormData(form)))});const result=await response.json();
output.textContent=JSON.stringify(result,null,2);
if(path==='start'&&response.status===202){form.hidden=true;form.reset();document.getElementById('verify').hidden=false;}
if(result.passed){form.reset();form.hidden=true;}
}catch{output.textContent='Request failed. Check the local test server.';}finally{button.disabled=false;}}
document.getElementById('signup').onsubmit=event=>{event.preventDefault();submit(event.target,'start');};
document.getElementById('verify').onsubmit=event=>{event.preventDefault();submit(event.target,'verify');};
</script></html>`));

  local.post<{ Body: { display_name: string; email: string; password: string } }>('/start', {
    bodyLimit: 4096, schema: { body: { type: 'object', additionalProperties: false,
      required: ['display_name', 'email', 'password'], properties: {
        display_name: { type: 'string', minLength: 1, maxLength: 120 }, email: { type: 'string', format: 'email', maxLength: 254 },
        password: { type: 'string', minLength: 12, maxLength: 128 } } } },
  }, async (request, reply) => {
    if (busy || pending) return reply.code(409).send({ error: 'A signup test is already pending; finish it or restart the test server.' });
    busy = true;
    try {
      const email = request.body.email.trim().toLowerCase();
      if ((await db.query('SELECT 1 FROM users WHERE lower(email)=lower($1)', [email])).rowCount) {
        return reply.code(409).send({ error: 'Use an unused email address you own, such as a Gmail +alias.' });
      }
      const registration = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: request.body });
      if (registration.statusCode !== 202) return reply.code(registration.statusCode).send(failure(registration));
      const challenge = registration.json<{ challenge_id: string }>();
      const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: request.body.password } });
      pending = { email, password: request.body.password, challenge_id: challenge.challenge_id, before_login_status: login.statusCode };
      const noAccount = !(await db.query('SELECT 1 FROM users WHERE lower(email)=lower($1)', [email])).rowCount;
      logger.info({ signup_status: 202, account_absent_before_verification: noAccount, before_login_status: login.statusCode }, 'Email signup code requested');
      return reply.code(202).send({ signup_status: 202, account_absent_before_verification: noAccount,
        before_login_status: login.statusCode, message: 'Check your inbox and spam folder. Enter the six-digit code below within ten minutes.' });
    } finally { busy = false; }
  });

  local.post<{ Body: { code: string } }>('/verify', {
    bodyLimit: 1024, schema: { body: { type: 'object', additionalProperties: false, required: ['code'],
      properties: { code: { type: 'string', pattern: '^[0-9]{6}$' } } } },
  }, async (request, reply) => {
    if (busy || !pending) return reply.code(409).send({ error: 'Request a signup code first or wait for the current check.' });
    busy = true;
    try {
      const input = { email: pending.email, challenge_id: pending.challenge_id, code: request.body.code };
      const verified = await app.inject({ method: 'POST', url: '/v1/auth/register/verify', payload: input });
      if (verified.statusCode !== 201) return reply.code(verified.statusCode).send(failure(verified));
      const signup = verified.json<{ access_token: string; user: { users_id: string } }>();
      const credentials = { email: pending.email, password: pending.password };
      const beforeLoginStatus = pending.before_login_status;
      pending = undefined;
      const sessions = [signup.access_token];
      const checks: Record<string, number | boolean> = { verification_status: verified.statusCode, before_login_status: beforeLoginStatus };
      try {
        const account = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { authorization: `Bearer ${signup.access_token}` } });
        checks.account_status = account.statusCode;
        checks.email_verified = account.json().user?.email_verified === true;
        const stored = await db.query<{ verified: boolean; password_stored: boolean }>(`SELECT u.email_verified_at IS NOT NULL AS verified,
          a.password_hash IS NOT NULL AND a.password_hash <> $2 AS password_stored
          FROM users u JOIN user_auth_accounts a ON a.users_id=u.users_id AND a.provider='password' WHERE u.users_id=$1`,
        [signup.user.users_id, credentials.password]);
        checks.database_account_verified = stored.rows[0]?.verified === true;
        checks.database_password_hashed = stored.rows[0]?.password_stored === true;
        const replay = await app.inject({ method: 'POST', url: '/v1/auth/register/verify', payload: input });
        checks.otp_replay_rejected = replay.statusCode === 400 && replay.json().error?.code === 'invalid_otp';
        const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: credentials });
        checks.password_login_status = login.statusCode;
        if (login.statusCode === 200) sessions.push(login.json<{ access_token: string }>().access_token);
      } finally {
        let revoked = true;
        for (const token of sessions) {
          const headers = { authorization: `Bearer ${token}` };
          const logout = await app.inject({ method: 'POST', url: '/v1/auth/logout', headers });
          const after = await app.inject({ method: 'GET', url: '/v1/auth/me', headers });
          revoked = revoked && logout.statusCode === 204 && after.statusCode === 401;
        }
        checks.test_sessions_revoked = revoked;
      }
      const report = { passed: checks.before_login_status === 401 && checks.account_status === 200 && checks.email_verified === true &&
        checks.database_account_verified === true && checks.database_password_hashed === true && checks.otp_replay_rejected === true &&
        checks.password_login_status === 200 && checks.test_sessions_revoked === true, ...checks };
      logger.info(report, 'Email OTP acceptance test completed');
      return report;
    } finally { busy = false; }
  });
}, { prefix: '/__email-test' });

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  pending = undefined;
  clearTimeout(expiry);
  await app.close();
}
const expiry = setTimeout(() => { void stop(); }, 20 * 60 * 1000);
process.once('SIGINT', () => { void stop(); });
process.once('SIGTERM', () => { void stop(); });
try {
  await app.listen({ host: '127.0.0.1', port: 3000 });
  logger.info({ url: 'http://localhost:3000/__email-test/', expires_in_minutes: 20 }, 'Open the local email OTP test');
} catch {
  logger.error('Could not start local email test; check port 3000');
  await stop();
  process.exitCode = 1;
}
