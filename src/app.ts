import Fastify, { type FastifyError, type FastifyBaseLogger } from 'fastify';
import type { AppConfig } from './config.js';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { createDatabase, type Database } from './database/index.js';
import { ApiError } from './errors.js';
import { authorization } from './modules/authorization/index.js';
import {browserSessionRoutes} from './modules/auth/browser-session.js';
import { authRoutes } from './modules/auth/routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import multipart from '@fastify/multipart';
import { memoryRevocations, redisRevocations, type TokenRevocations } from './modules/auth/revocations.js';
import { cloudinaryStorage } from './adapters/cloudinary.js';
import { mediaRoutes } from './modules/media/routes.js';
import type { MediaStorage } from './modules/media/types.js';
import { investigationRoutes } from './modules/investigations/routes.js';
import { investigationJobs } from './adapters/investigation-jobs.js';
import type { InvestigationJobs } from './modules/investigations/types.js';
import { researchAdminRoutes } from './modules/research/admin-routes.js';
import { directoryRoutes } from './modules/directory/routes.js';
import { trustRoutes } from './modules/trust/routes.js';
import { sharingRoutes } from './modules/sharing/routes.js';
import { databaseReadiness, researchReadiness } from './runtime/readiness.js';
import { redisAuthChallenges } from './adapters/auth-challenges.js';
import { queuedOtpMailer } from './adapters/otp-email-jobs.js';
import { googleIdentity } from './adapters/google-identity.js';
import type { AuthDependencies } from './modules/auth/identity-types.js';
import { createLogger } from './logger.js';
import { registerDocumentation } from './documentation.js';
import {planRoutes} from './modules/billing/plans.js';
import { billingRoutes } from './modules/billing/routes.js';
import { consumeUnit, billingReadiness } from './modules/billing/service.js';
import {creditRoutes,awardWelcome,consumeCredits,creditPolicy} from './modules/billing/credits.js';
import { bachsProvider } from './adapters/bachs.js';
import type { BillingProvider } from './modules/billing/types.js';
import { accountRoutes } from './modules/auth/account-routes.js';
import { securityRoutes } from './modules/auth/security-routes.js';
import { platformRoutes } from './modules/platform/routes.js';
import { businessOwnerRoutes } from './modules/platform/businesses.js';
import { teamRoutes } from './modules/platform/teams.js';
import { apiKeyRoutes } from './modules/platform/api-keys.js';
import { platformReadiness } from './modules/platform/schema.js';

export function buildApp(config: AppConfig, database?: Database,
  dependencies: { storage?: MediaStorage; revocations?: TokenRevocations; jobs?: InvestigationJobs; auth?: AuthDependencies; billing?:BillingProvider } = {}) {
  const app = Fastify({
    loggerInstance: createLogger('api', config.logLevel) as FastifyBaseLogger,
    bodyLimit: 1024 * 1024,
    trustProxy: config.trustProxy,
    requestTimeout: config.requestTimeoutMs,
    forceCloseConnections: 'idle',
    ajv: { customOptions: { removeAdditional: false } },
  });

  registerDocumentation(app, config.uploadMaxBytes);

  const db = database ?? createDatabase(config.databaseUrl);
  const revocations = dependencies.revocations ?? (config.redisUrl ? redisRevocations(config.redisUrl) : memoryRevocations());
  const storage = dependencies.storage ?? (config.cloudinary ? cloudinaryStorage(config.cloudinary) : undefined);
  const jobs = dependencies.jobs ?? (config.redisUrl ? investigationJobs(config.redisUrl) : undefined);
  const billing=dependencies.billing??(config.bachs?bachsProvider(config.bachs):undefined);
  const identity:AuthDependencies={
    platformEnabled:config.platformEnabled,
    onRegistered:config.creditsEnabled?(client,userId)=>awardWelcome(client,userId,config.bachsEnvironment):undefined,
    challenges:dependencies.auth?.challenges??(config.redisUrl?redisAuthChallenges(config.redisUrl):undefined),
    mailer:dependencies.auth?.mailer??(config.smtp&&config.redisUrl?queuedOtpMailer(config.redisUrl,config.jwtSecret):undefined),
    google:dependencies.auth?.google??(config.googleClientId?googleIdentity(config.googleClientId):undefined),
  };
  app.addHook('onClose', async () => {
    const results = await Promise.allSettled([
      ...(!dependencies.jobs && jobs ? [Promise.resolve().then(()=>jobs.close())] : []),
      ...(!dependencies.revocations ? [Promise.resolve().then(()=>revocations.close())] : []),
      ...(!database ? [Promise.resolve().then(()=>db.close())] : []),
      ...(!dependencies.auth?.challenges&&identity.challenges?[identity.challenges.close()]:[]),
      ...(!dependencies.auth?.mailer&&identity.mailer?[Promise.resolve().then(()=>identity.mailer!.close())]:[]),
    ]);
    if (results.some(result => result.status === 'rejected')) throw new Error('Resource cleanup failed');
  });
  let draining = false;
  app.addHook('preClose', async () => { draining = true; });
  app.addHook('onSend', async (request, reply, payload) => {
    if (draining) reply.header('Connection','close');
    if (['/health','/ready'].includes(request.url.split('?')[0]!)) reply.header('Cache-Control','no-store');
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message }, request_id: request.id });
    }
    const frameworkError = error as FastifyError;
    if (frameworkError.validation) {
      return reply.code(400).send({ error: { code: 'invalid_request', message: 'Request validation failed' }, request_id: request.id });
    }
    if (frameworkError.statusCode && frameworkError.statusCode < 500) {
      return reply.code(frameworkError.statusCode).send({ error: { code: 'request_rejected', message: frameworkError.statusCode === 429 ? 'Too many requests' : 'Request rejected' }, request_id: request.id });
    }
    // Do not log arbitrary provider/database messages which can contain secrets.
    request.log.error({ request_id: request.id }, 'Request failed');
    return reply.code(500).send({ error: { code: 'internal_error', message: 'The request could not be completed' }, request_id: request.id });
  });

  app.after(() => {
    app.get('/health', async () => ({ status: 'ok', service: 'padicheck-backend' }));

    app.get('/ready', async (_request, reply) => {
      try {
        await databaseReadiness(db);
        await researchReadiness(db,config);
        if(config.billingEnabled||config.creditsEnabled)await billingReadiness(db);
        if(config.creditsEnabled)await creditPolicy(db,config.bachsEnvironment);
        if(config.platformEnabled){await platformReadiness(db);await db.query('SELECT browser_token_hash,browser_jti,browser_expires_at FROM auth_sessions LIMIT 0');}
        await revocations.ping();
        if (jobs) await jobs.ping();
        if(identity.challenges&&(identity.mailer||identity.google))await identity.challenges.ping();
        if(identity.mailer)await identity.mailer.verify();
        return { status: 'ready', background_jobs: jobs ? 'configured' : 'unconfigured',
          media_storage: storage ? 'configured' : 'unconfigured', research: config.researchEnabled ? 'enabled' : 'disabled',
          email_signup:identity.mailer&&identity.challenges?'configured':'unconfigured',google_signin:identity.google&&identity.challenges?'configured':'unconfigured',
          credits:config.creditsEnabled?'enabled':'disabled',billing:config.billingEnabled?'enabled':'disabled', platform_extensions:config.platformEnabled?'enabled':'disabled' };
      } catch {
        return reply.code(503).send({ status: 'unavailable' });
      }
    });

    app.register(async api => {
      await api.register(jwt, {
        secret: config.jwtSecret,
        sign: { algorithm: 'HS256', expiresIn: '15m', iss: 'padicheck', aud: 'padicheck-api' },
        verify: { algorithms: ['HS256'], allowedIss: 'padicheck', allowedAud: 'padicheck-api' },
      });
      await api.register(rateLimit, { global: false });
      await api.register(multipart, { limits: { files: 1, fields: 0, parts: 1, fileSize: config.uploadMaxBytes } });
      const access = authorization(api, db, revocations, config.platformEnabled);
      await browserSessionRoutes(api,db,access,config);
      await authRoutes(api, db, access, revocations, identity, config.jwtSecret);
      await securityRoutes(api,db,access,config);
      await accountRoutes(api,db,access,identity,config.jwtSecret);
      await platformRoutes(api,db,access,config.platformEnabled);
      await teamRoutes(api,db,access,config.platformEnabled);
      await businessOwnerRoutes(api,db,access,config.platformEnabled);
      await apiKeyRoutes(api,db,access,config.platformEnabled);
      await adminRoutes(api, db, access);
      await researchAdminRoutes(api, db, access);
      await mediaRoutes(api, db, access, storage, config.uploadMaxBytes);
      await billingRoutes(api,db,access,config,billing);
      await planRoutes(api,db,access,config,billing);
      await creditRoutes(api,db,access,config);
      await investigationRoutes(api, db, access, jobs, config.researchEnabled,
        config.creditsEnabled?(client,userId,id,input)=>consumeCredits(client,userId,id,config.bachsEnvironment,input):
        config.billingEnabled?(client,userId,id)=>consumeUnit(client,userId,id,config.bachsEnvironment):undefined);
      await directoryRoutes(api, db, access);
      await trustRoutes(api, db, access);
      await sharingRoutes(api, db, access);
    });

  });
  return app;
}
