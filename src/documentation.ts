import type { FastifyInstance, FastifySchema } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

const record = { type: 'object', additionalProperties: true };
const string = { type: 'string' };
const boolean = { type: 'boolean' };
const array = { type: 'array', items: record };
const envelope = (properties: Record<string, unknown>) => ({ type: 'object', properties });
const error = envelope({ error: envelope({ code: string, message: string }), request_id: string });
const session = envelope({ user: envelope({ users_id: { type: 'string', format: 'uuid' }, display_name: string,
  email: { type: 'string', format: 'email' }, email_verified: boolean }), access_token: string,
  token_type: { type: 'string', enum: ['Bearer'] }, expires_in: { type: 'integer', example: 900 } });
const challenge = envelope({ challenge_id: { type: 'string', format: 'uuid' },
  expires_in: { type: 'integer', example: 600 }, message: string });

// Documentation only: these response schemas never become runtime serializers.
function response(url: string, method: string): { status: number; schema?: object } {
  if (url === '/health') return { status: 200, schema: envelope({ status: string, service: string }) };
  if (url === '/ready') return { status: 200, schema: envelope({ status: string, background_jobs: string,
    media_storage: string, research: string, email_signup: string, google_signin: string, billing: string, platform_extensions: string }) };
  if (url === '/v1/webhooks/bachs') return {status:202,schema:envelope({received:boolean})};
  if (url === '/v1/billing/offers') return {status:200,schema:envelope({enabled:boolean,offers:array})};
  if (url === '/v1/credits/policy'||url === '/v1/admin/credits/policy')return {status:200,schema:envelope({enabled:boolean,policy:{...record,nullable:true}})};
  if(url === '/v1/credits/me')return {status:200,schema:envelope({enabled:boolean,available_units:{type:'integer'},transactions:array})};
  if(url === '/v1/auth/session')return method==='DELETE'?{status:204}:{status:200,schema:session};
  if(url === '/v1/billing/plans'||url === '/v1/admin/billing/plans')return {status:method==='POST'?201:200,schema:envelope(method==='POST'?{plan:record}:{plans:array,billing_enabled:boolean})};
  if(url.startsWith('/v1/admin/billing/plans/'))return {status:200,schema:envelope(url.endsWith('/enable-checkout')?{enabled:boolean,manual_renewal:boolean}:{plan:record})};
  if(url === '/v1/billing/history')return {status:200,schema:envelope({entries:array,has_more:boolean})};
  if (url === '/v1/billing/me') return {status:200,schema:envelope({enabled:boolean,available_units:{type:'integer'},subscriptions:array})};
  if (url === '/v1/billing/portal') return {status:200,schema:envelope({url:{type:'string',format:'uri'}})};
  if (url.startsWith('/v1/billing/checkouts')) return {status:method==='POST'?201:200,schema:envelope({checkout:record})};
  if (url.startsWith('/v1/admin/billing/')) return {status:method==='POST'&&url.endsWith('/offers')?201:200,
    schema:envelope(method==='GET'?{[url.split('/').at(-1)!]:array}:url.includes('/grants/')?{grant:record}:{offer:record})};
  if (['/v1/auth/logout','/v1/auth/logout-all'].includes(url) || method === 'DELETE') return { status: 204 };
  if(url==='/v1/auth/sessions')return {status:200,schema:envelope({sessions:array})};
  if(url==='/v1/auth/mfa')return {status:200,schema:envelope({enabled:boolean,recovery_codes_remaining:{type:'integer'}})};
  if(url==='/v1/auth/mfa/setup')return {status:200,schema:envelope({secret:string,otpauth_uri:string,expires_in:{type:'integer',example:600}})};
  if(url==='/v1/auth/mfa/verify')return {status:200,schema:session};
  if(url.startsWith('/v1/auth/mfa/'))return {status:200,schema:envelope({enabled:boolean,recovery_codes:{type:'array',items:string},sign_in_required:boolean})};
  if(url==='/v1/me/bookmarks')return {status:200,schema:envelope({bookmarks:array})};
  if(url.endsWith('/bookmark'))return {status:200,schema:envelope({bookmarked:boolean})};
  if(url==='/v1/me/notifications')return {status:200,schema:envelope({notifications:array})};
  if(url.startsWith('/v1/me/notifications/'))return {status:200,schema:envelope({notification:record})};
  if(url==='/v1/me/notification-preferences')return {status:200,schema:envelope(method==='GET'?{preferences:array}:{preference:record})};
  if(url.startsWith('/v1/me/api-keys'))return {status:method==='POST'?201:200,schema:envelope(method==='GET'?{api_keys:array}:{api_key:record,secret:string})};
  if(url==='/v1/me/business-invitations')return {status:200,schema:envelope({invitations:array})};
  if(url.startsWith('/v1/me/business-invitations/'))return {status:200,schema:envelope({accepted:boolean})};
  if(url.startsWith('/v1/businesses/'))return {status:url.endsWith('/invitations')&&method==='POST'?201:200,
    schema:envelope(url.endsWith('/team')?{owner_user_id:string,members:array,invitations:array}:url.endsWith('/invitations')?{invitation:record,delivery:{type:'string',enum:['in_app']}}:url.endsWith('/profile')?{business:record}:{updated:boolean})};
  if (['/v1/auth/register','/v1/auth/email/request'].includes(url)) return { status: 202, schema: challenge };
  if (['/v1/auth/login','/v1/auth/register/verify','/v1/auth/google'].includes(url)) {
    return { status: url.endsWith('register/verify') ? 201 : 200, schema: url.endsWith('register/verify')?session:{oneOf:[{...session,required:['user','access_token','token_type','expires_in']},
      {...envelope({mfa_required:{type:'boolean',enum:[true]},challenge_token:string,expires_in:{type:'integer',example:300}}),required:['mfa_required','challenge_token','expires_in']}]} };
  }
  if (url === '/v1/auth/google/challenge') return { status: 200, schema: envelope({ nonce: string, expires_in: { type: 'integer', example: 300 } }) };
  if (url === '/v1/auth/google/link') return { status: 200, schema: envelope({ linked: boolean }) };
  if (url === '/v1/auth/email/verify') return { status: 200, schema: envelope({ email_verified: boolean }) };
  if (url === '/v1/auth/me') return { status: 200, schema: envelope({ user: record }) };
  if (url.endsWith('/delivery')) return { status: 200, schema: envelope({ url: { type: 'string', format: 'uri' }, expires_at: { type: 'integer' } }) };
  if (url.endsWith('/roles')) return { status: 200, schema: envelope(method === 'GET' ? { roles: array } : { granted: boolean }) };
  if (url.includes('/admin/ai/')) return { status: method === 'POST' && !url.endsWith('agent-tools') ? 201 : 200,
    schema: envelope(method === 'GET' ? { entries: array } : { entry: record }) };
  if (url.includes('/share-links')) return { status: method === 'POST' && !url.endsWith('/revoke') ? 201 : 200,
    schema: envelope(method === 'GET' ? { shares: array } : url.endsWith('/revoke') ? { share: record } : { share: record, token: string }) };
  if (url.includes('/shared-investigations/')) return { status: 200, schema: envelope({ investigation: record,
    findings: array, findings_truncated: boolean, limitations: { type: 'array', items: string } }) };
  if (url.includes('/investigations')) {
    const subresource = ['findings','sources','model-runs'].find(name => url.endsWith(`/${name}`));
    if (subresource) return { status: 200, schema: envelope({ [subresource.replace('-', '_')]: array, limitations: { type: 'array', items: string }, capabilities: record }) };
    const list = method === 'GET' && url === '/v1/investigations';
    return { status: method === 'POST' && !url.endsWith('/cancel') ? 202 : 200,
      schema: envelope(list ? { investigations: array, next_cursor: { type: 'string', nullable: true } } :
        { investigation: record, dispatch: string, capabilities: record, targets: array, source_collection_complete: boolean, specialist_checks: array,
          limitations: { type: 'array', items: string } }) };
  }
  const resource = url.includes('/media') ? 'media' : url.includes('/verifications') ? 'verification' :
    url.includes('/disputes') ? 'dispute' : url.includes('/reports') ? 'report' : 'business';
  const list = method === 'GET' && !(url.split('/').at(-1) ?? '').startsWith(':');
  const plural = resource === 'business' ? 'businesses' : resource === 'media' ? 'media' : `${resource}s`;
  return { status: method === 'POST' && ['/v1/media','/v1/verifications','/v1/reports','/v1/admin/businesses'].includes(url) ||
    method === 'POST' && url === '/v1/reports/:id/disputes' ? 201 : 200,
    schema: envelope({ [list ? plural : resource]: list ? array : record, evidence: array,
      ...(url.startsWith('/v1/directory') ? { identifiers: array, verification_review: { ...record, nullable: true }, limitations: { type: 'array', items: string } } : {}) }) };
}

function permission(url: string, method: string): string {
  if(url==='/v1/auth/mfa/verify')return 'Public second-factor completion. Send the five-minute challenge_token from password/Google login and a six-digit authenticator code or a 24-character recovery code. Five challenge attempts; temporary per-account lockout. Challenge tokens cannot authorize other endpoints.';
  if(url.startsWith('/v1/auth/mfa'))return 'Requires enabled platform extension and a registered user session. Setup/confirm/disable/recovery-code regeneration require login within five minutes. Mutations require valid proof; enabling/disabling/regenerating revokes all sessions. Setup returns a sensitive provisioning secret once; never log or upload it.';
  if(url==='/v1/auth/sessions'||url.startsWith('/v1/auth/sessions/')||url==='/v1/auth/logout-all')return 'Registered user session required. Only your sessions are accessible. Logout-all revokes sessions and pending MFA login challenges; it does not revoke API keys.';
  if(url.startsWith('/v1/me/api-keys'))return 'User-session authentication only. Create/rotate require verified email and login within five minutes. Secret returned once; list contains metadata only. Maximum 20 active keys; expiry 1–90 days. Scopes never exceed live account permissions. Rotation immediately revokes old key.';
  if(url.startsWith('/v1/me/business-invitations'))return 'Verified user-session authentication. Only invitations to your verified account email are listed/accepted; expired/revoked invitations and invitations from a previous owner are unavailable.';
  if(url.startsWith('/v1/businesses/'))return 'Verified user-session authentication. Claimed owner manages invitations and membership. Owner, manager and editor can edit category/description; viewer cannot edit. Team membership grants no platform staff permissions. Ownership changes clear memberships and revoke invitations. Invitation delivery is in-app, not SMTP.';
  if(url.startsWith('/v1/me/')||url.endsWith('/bookmark'))return 'Enabled platform extension and user-session authentication required. Owner-only records; list limit defaults to 20 (maximum 100), offset defaults to zero (maximum 10000). Bookmarks additionally require investigation read permission. Notifications are in-app and contain related record IDs, not private evidence.';
  if(url.startsWith('/v1/admin/billing/'))return 'Requires the superadmin role. Billing offer price/product/mode/units are immutable: create another offer for a price change. Mutations are audited.';
  if (url.startsWith('/v1/admin/ai/')) return 'Requires ai_config.manage. Only superadmins may change credential references; values are server-side environment references.';
  if (url === '/v1/admin/roles') return 'Requires roles.read.';
  if (url.endsWith('/roles')) return 'Requires roles.manage and the superadmin role.';
  if (url.startsWith('/v1/admin/businesses')) return `Requires ${url.endsWith('/publication') ? 'directory.manage' : 'businesses.manage'}.`;
  if (url.startsWith('/v1/admin/verifications')) return 'Requires verifications.review. Self-review and conflicting business claims are rejected.';
  if (url.startsWith('/v1/admin/reports')) return 'Requires reports.moderate. Self-review and business-owner conflicts are rejected.';
  if (url.startsWith('/v1/admin/disputes')) return 'Requires disputes.resolve; unpublishing also requires reports.moderate. Resolution requires report_action; other statuses must omit it.';
  if (url.includes('/share-links')) return 'Only the investigation owner may manage links. Creation requires a completed investigation, investigations.create and investigation read permission. Acknowledge sensitive content; the raw token is returned once. Maximum 10 active links.';
  if (url.startsWith('/v1/investigations')) return method === 'GET' ?
    'Requires investigations.read_own for owned investigations or investigations.read_all. scope=all requires investigations.read_all. AI findings remain unverified.' :
    'Requires investigations.create. Cancel/retry are owner-only; only active investigations can be cancelled and only failed investigations retried. Processing is asynchronous; poll the detail endpoint.';
  if (url.startsWith('/v1/media')) return 'Owner access or media.manage; authorized evidence reviewers may read linked evidence. Delivery URLs expire after 300 seconds. Referenced media cannot be deleted.';
  if (url === '/v1/reports' && method === 'POST') return 'Requires reports.submit. Entity must be in the published directory or one of your investigations; evidence must be your own ready media.';
  if (/^\/v1\/(verifications|reports|disputes)/.test(url)) return 'Authenticated access. Lists show your own submissions; detail access also permits authorized reviewers. Evidence must be owned ready media; state transitions are enforced.';
  return '';
}

const notes: Record<string, string> = {
  '/health': 'Liveness only; does not probe database or external services.',
  '/ready': 'Checks database, enabled research registry and configured Redis resources. Configuration indicators do not prove live SMTP, Google or Cloudinary connectivity. Returns 503 when unavailable.',
  '/v1/auth/register': 'Start password signup. Existing emails return 409 account_exists with a sign-in message and no OTP/challenge. For a new email, queues a six-digit code; 202 confirms queue acceptance, not inbox delivery. No account or token is created until verification. Code expires 10 minutes after the request, with five attempts, a 60-second resend cooldown and five requests per hour per email. Repeat this endpoint to resend while signup is pending. Requires Redis, SMTP configuration and a running email worker.',
  '/v1/auth/register/verify': 'Complete signup with email, challenge_id and the emailed six-digit code. Returns a 15-minute access token. Codes are single-use; request a new code after an unsuccessful account-creation transaction.',
  '/v1/auth/login': 'Password login returns a 15-minute access token. Use it in Authorize for protected routes.',
  '/v1/auth/logout': 'Revokes the current access token until its expiration. No response body.',
  '/v1/auth/me': 'Returns the current account, verification status, roles and permissions.',
  '/v1/auth/email/request': 'Queue a verification code to the authenticated account email. 202 confirms queue acceptance, not delivery. Requires Redis, SMTP configuration and a running email worker.',
  '/v1/auth/email/verify': 'Verify the authenticated account email using its email-purpose challenge and six-digit code.',
  '/v1/auth/google/challenge': 'Create a single-use nonce valid for five minutes. Pass it to Google Identity Services. action=login is public; action=link requires your existing Bearer token. Requires Redis and GOOGLE_CLIENT_ID.',
  '/v1/auth/google': 'Exchange a Google ID token containing the issued nonce for a PadiCheck access token. Existing password accounts must sign in and explicitly link Google. New accounts require an authoritative verified Google email.',
  '/v1/auth/google/link': 'Link a Google ID token using an action=link nonce bound to your account. Its email must match your verified account email.',
  '/v1/shared-investigations/resolve': 'Redeem a share token in the JSON body. No JWT is required. Returns a limited completed-result view; expired, revoked or invalid links return 404. Treat tokens and result content as sensitive.',
  '/v1/billing/offers': 'Public enabled catalog. Returns enabled=false and no offers when BILLING_ENABLED is false. Amounts are decimal currency strings, not minor units.',
  '/v1/credits/policy': 'Public check costs when credit enforcement is enabled. Property has its own price. Prices are authoritative at submission.',
  '/v1/admin/credits/policy': 'Superadmin-only welcome bonus and per-type costs. PUT requires the current revision; changes are audited. Zero disables a bonus or makes a check free.',
  '/v1/credits/me': 'Owned credit balance and latest 100 grant/debit transactions. Includes welcome and paid credits. Never awards credits on read.',
  '/v1/billing/me': 'Owned balance and subscription state. Credit enforcement can operate independently of paid checkouts. Legacy billing-only mode consumes one unit per investigation.',
  '/v1/billing/checkouts': 'Requires JWT and verified email. Send offer_key and a UUID request_key. Reuse the same key for retries; using it for another offer returns 409. The server controls pricing and redirect URLs. A 201 checkout does not prove payment. Save billing_checkout_id before redirecting to checkout_url.',
  '/v1/billing/checkouts/:id': 'Owned checkout status; this read never grants units. Poll after redirect while webhook processing is pending. Use the local billing_checkout_id, not the provider checkout_id appended to the redirect URL.',
  '/v1/billing/portal': 'Send an owned local billing_subscription_id to create a fresh provider customer-portal URL. The URL is a session credential; do not log or persist it.',
  '/v1/webhooks/bachs': 'Provider endpoint, not a frontend callback. Raw JSON is authenticated using X-Bachs-Signature-V2 (t=timestamp,v1=HMAC) or legacy signature plus timestamp. The verified merchant event is durably stored before 202. Processing runs in the API background loop and retries pending events. No user JWT is required.',
};

const examples: Record<string, object> = {
  '/v1/auth/register': { display_name: 'Example User', email: 'user@example.com', password: 'ExamplePassword123!' },
  '/v1/auth/login': { email: 'user@example.com', password: 'ExamplePassword123!' },
  '/v1/auth/register/verify': { email: 'user@example.com', challenge_id: '00000000-0000-4000-8000-000000000000', code: '012345' },
  '/v1/auth/email/verify': { email: 'user@example.com', challenge_id: '00000000-0000-4000-8000-000000000000', code: '012345' },
  '/v1/auth/google/challenge': { action: 'login' },
  '/v1/auth/google': { id_token: 'REPLACE_WITH_GOOGLE_ID_TOKEN_CONTAINING_ISSUED_NONCE' },
  '/v1/auth/google/link': { id_token: 'REPLACE_WITH_GOOGLE_ID_TOKEN_CONTAINING_LINK_NONCE' },
};

const summaries: Record<string, string> = {
  '/v1/auth/register': 'Start password signup and send email OTP',
  '/v1/auth/register/verify': 'Verify signup OTP and create account',
  '/v1/auth/login': 'Log in with email and password',
  '/v1/auth/logout': 'Log out and revoke current token',
  '/v1/auth/me': 'Get current account and permissions',
  '/v1/auth/email/request': 'Send account email verification OTP',
  '/v1/auth/email/verify': 'Verify current account email',
  '/v1/auth/google/challenge': 'Request Google login or linking nonce',
  '/v1/auth/google': 'Sign in with Google ID token',
  '/v1/auth/google/link': 'Link Google identity to current account',
  '/v1/shared-investigations/resolve': 'Redeem shared investigation token',
};

function documentSchema(schema: FastifySchema = {}, url: string, method: string, maxBytes: number): FastifySchema {
  if (url.startsWith('/docs')) return { ...schema, hide: true };
  const publicRoute = ['/health','/ready','/v1/auth/register','/v1/auth/register/verify','/v1/auth/login',
    '/v1/auth/session','/v1/auth/google','/v1/auth/google/challenge','/v1/auth/mfa/verify','/v1/shared-investigations/resolve','/v1/billing/offers','/v1/billing/plans','/v1/credits/policy','/v1/webhooks/bachs'].includes(url) || url.startsWith('/v1/directory');
  const tag = url.includes('/billing')||url.includes('/webhooks/bachs')?'Billing':url.startsWith('/v1/auth') ? 'Authentication' : url.includes('/admin/ai/') ? 'AI registry' :
    url.includes('share') ? 'Sharing' : url.includes('/investigations') ? 'Investigations' : url.includes('/media') ? 'Media' :
    url.includes('/verifications') ? 'Verifications' : url.includes('/disputes') ? 'Disputes' : url.includes('/reports') ? 'Reports' :
    url.includes('/directory') || url.includes('/businesses') ? 'Directory' : url.includes('/admin') ? 'Administration' : 'Health';
  const result = response(url, method);
  const responses: Record<string, unknown> = {
    [result.status]: result.schema ? { ...result.schema, description: result.status === 202 ? 'Accepted' : 'Success' } : { type: 'null', description: 'No content' },
    500: { ...error, description: 'Internal error' },
  };
  if (url === '/ready') responses[503] = { ...envelope({ status: string }), description: 'Service unavailable' };
  if (url.startsWith('/v1/')) {
    for (const [status, description] of Object.entries({ 400: 'Invalid request', 404: 'Resource not found or unavailable',
      409: 'Conflict or invalid state transition', 429: 'Rate limit exceeded', 503: 'Required service is not configured or unavailable' })) {
      responses[status] = { ...error, description };
    }
    if (!publicRoute || url.endsWith('/google/challenge') || url === '/v1/auth/login' || url === '/v1/auth/google') {
      responses[401] = { ...error, description: 'Invalid or missing credentials' };
    }
    if (!publicRoute) responses[403] = { ...error, description: 'Permission denied' };
  }
  if (url === '/v1/media' && method === 'POST') {
    for (const [status, description] of Object.entries({ 413: 'Upload exceeds size limit', 415: 'Unsupported or mismatched media type', 502: 'Storage upload failed' })) responses[status] = { ...error, description };
  }
  if(url==='/v1/investigations'&&method==='POST')responses[402]={...error,description:'Billing enabled but no available investigation units'};
  const description = [notes[url], permission(url, method), url === '/v1/media' && method === 'POST' ?
    `Send exactly one file field named file with no additional fields. Maximum ${maxBytes} bytes. Supported content: JPEG, PNG, WebP, GIF, MP4, WebM, MP3, WAV, FLAC, OGG and PDF. Cloudinary stores the contents; PostgreSQL stores metadata.` : ''].filter(Boolean).join('\n\n');
  return { ...schema, tags: [tag], operationId: `${method.toLowerCase()}_${url.replace(/^\//, '').replace(/:/g, '').replace(/[^a-zA-Z0-9]+/g, '_')}`,
    summary: summaries[url] ?? `${method === 'GET' ? 'Get' : method === 'PATCH' ? 'Update' : method === 'DELETE' ? 'Delete' : 'Submit'} ${url.replace(/^\/v1\//, '').replace(/[:/]/g, ' ').replace(/[-_]/g, ' ').trim()}`,
    description: description || 'Public access to published directory content.',
    security: publicRoute ? url.endsWith('/google/challenge') ? [{}, { bearerAuth: [] }] : [] :
      ((url==='/v1/investigations'&&['GET','POST'].includes(method))||method==='GET'&&/^\/v1\/investigations\/:investigation_id(?:\/(?:findings|sources|model-runs))?$/.test(url))?
      [{bearerAuth:[]},{apiKeyAuth:[]}]:[{ bearerAuth: [] }],
    response: responses,
    ...(schema.body && examples[url] ? { body: { ...(schema.body as Record<string, unknown>), example: examples[url] } } : {}),
    ...(url==='/v1/webhooks/bachs'?{body:{type:'object',required:['id','type','organization_id','created_at','data'],properties:{
      id:string,type:string,organization_id:string,created_at:{type:'string',format:'date-time'},data:record}},
      headers:{type:'object',properties:{'x-bachs-signature-v2':{type:'string',description:'t=<Unix seconds>,v1=<HMAC SHA256 hex>. Signed against the exact raw request bytes.'}}}}:{}),
    ...(url === '/v1/media' && method === 'POST' ? { consumes: ['multipart/form-data'], body: {
      type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } },
    } } : {}),
  };
}

export function registerDocumentation(app: FastifyInstance, maxBytes: number) {
  app.register(swagger, {
    openapi: { openapi: '3.0.3', info: { title: 'PadiCheck Backend API', version: '0.1.0',
      description: 'Password + email OTP signup, Google identity, investigations, media and trust operations. Authenticate with a PadiCheck access token using Authorize. Roles, ownership and state transitions are enforced by the backend.' },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },apiKeyAuth:{type:'apiKey',in:'header',name:'X-API-Key'} } } },
    transform: ({ schema, url, route }) => ({ schema: documentSchema(schema, url, String(route.method).toUpperCase(), maxBytes), url }),
  });
  app.register(swaggerUi, { routePrefix: '/docs',
    uiConfig: { persistAuthorization: false, docExpansion: 'none', displayRequestDuration: true },
  });
}
