import { isIP } from 'node:net';
import { specialistConfig } from './adapters/specialist-config.js';

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const specialist = specialistConfig(env);
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const rawPort = env.PORT ?? '3000';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const host = env.HOST ?? '127.0.0.1';
  if (!host.trim()) throw new Error('HOST must not be empty');

  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'].includes(logLevel)) {
    throw new Error('LOG_LEVEL is invalid');
  }

  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  try {
    const url = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string');
  }
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32) {
    throw new Error('JWT_SECRET must contain at least 32 bytes');
  }

  const redisUrl = env.REDIS_URL || undefined;
  if (redisUrl) {
    try { if (!['redis:', 'rediss:'].includes(new URL(redisUrl).protocol)) throw new Error(); }
    catch { throw new Error('REDIS_URL must be a Redis connection string'); }
  }
  if (nodeEnv === 'production' && !redisUrl) throw new Error('REDIS_URL is required in production for shared token revocation');
  const cloudinaryValues = [env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET];
  if (cloudinaryValues.some(Boolean) && !cloudinaryValues.every(Boolean)) {
    throw new Error('Set all three Cloudinary environment variables or leave all unset');
  }
  const cloudinary = cloudinaryValues.every(Boolean) ? {
    cloudName: env.CLOUDINARY_CLOUD_NAME!, apiKey: env.CLOUDINARY_API_KEY!, apiSecret: env.CLOUDINARY_API_SECRET!,
  } : undefined;
  if (cloudinary && !/^[a-z0-9_-]+$/i.test(cloudinary.cloudName)) throw new Error('Invalid CLOUDINARY_CLOUD_NAME');
  const uploadMaxBytes = Number(env.MEDIA_MAX_BYTES ?? 10 * 1024 * 1024);
  if (!Number.isSafeInteger(uploadMaxBytes) || uploadMaxBytes < 1 || uploadMaxBytes > 25 * 1024 * 1024) {
    throw new Error('MEDIA_MAX_BYTES must be an integer between 1 and 26214400');
  }
  const workerConcurrency = Number(env.WORKER_CONCURRENCY ?? 2);
  if (!Number.isInteger(workerConcurrency) || workerConcurrency < 1 || workerConcurrency > 10) throw new Error('WORKER_CONCURRENCY must be between 1 and 10');
  const reconcileIntervalMs = Number(env.INVESTIGATION_RECONCILE_INTERVAL_MS ?? 10000);
  if (!Number.isInteger(reconcileIntervalMs) || reconcileIntervalMs < 1000 || reconcileIntervalMs > 300000) throw new Error('INVESTIGATION_RECONCILE_INTERVAL_MS must be between 1000 and 300000');
  if (env.RESEARCH_ENABLED && !['true', 'false'].includes(env.RESEARCH_ENABLED)) throw new Error('RESEARCH_ENABLED must be true or false');
  const researchEnabled = env.RESEARCH_ENABLED === 'true';
  const ultraSearchUrl = env.ULTRASEARCH_URL || undefined;
  if (ultraSearchUrl) {
    try {
      const url = new URL(ultraSearchUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    } catch { throw new Error('ULTRASEARCH_URL must be an HTTP(S) service URL without credentials or query parameters'); }
  }
  const milliseconds = (name: string, fallback: number, maximum: number) => {
    const raw = env[name] ?? String(fallback);
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isInteger(value) || value < 1000 || value > maximum) throw new Error(`${name} is outside its supported millisecond range`);
    return value;
  };
  const startupTimeoutMs = milliseconds('STARTUP_TIMEOUT_MS', 30000, 120000);
  const shutdownTimeoutMs = milliseconds('SHUTDOWN_TIMEOUT_MS', 180000, 600000);
  const requestTimeoutMs = milliseconds('REQUEST_TIMEOUT_MS', 65000, 120000);
  let trustProxy: false | string[] = false;
  if (env.TRUST_PROXY) {
    const entries = env.TRUST_PROXY.split(',').map(value => value.trim());
    if (entries.length > 16 || entries.some(value => {
      const [address, prefix, extra] = value.split('/');
      const family = isIP(address ?? '');
      return !family || extra !== undefined || (prefix !== undefined &&
        (!/^\d+$/.test(prefix) || Number(prefix) > (family === 4 ? 32 : 128)));
    })) throw new Error('TRUST_PROXY must be a comma-separated list of trusted IP addresses or CIDRs');
    trustProxy = entries;
  }
  const geminiConfigured = Boolean(env.GEMINI_API_KEY?.trim());
  const smtpValues=[env.SMTP_HOST,env.SMTP_FROM,env.SMTP_USER,env.SMTP_PASSWORD,env.SMTP_PORT,env.SMTP_SECURE];
  let smtp: {host:string;from:string;port:number;secure:boolean;user?:string;password?:string}|undefined;
  if(smtpValues.some(Boolean)){
    if(!env.SMTP_HOST?.trim()||!env.SMTP_FROM||!/^\S+@[^\s@]+\.[^\s@]+$/.test(env.SMTP_FROM)||/[\r\n]/.test(env.SMTP_HOST))throw new Error('SMTP_HOST and a valid SMTP_FROM are required');
    if(Boolean(env.SMTP_USER)!==Boolean(env.SMTP_PASSWORD))throw new Error('Set both SMTP_USER and SMTP_PASSWORD');
    const smtpPort=Number(env.SMTP_PORT||587);
    if(!Number.isInteger(smtpPort)||smtpPort<1||smtpPort>65535)throw new Error('SMTP_PORT must be a valid port');
    if(env.SMTP_SECURE&&!['true','false'].includes(env.SMTP_SECURE))throw new Error('SMTP_SECURE must be true or false');
    smtp={host:env.SMTP_HOST.trim(),from:env.SMTP_FROM,port:smtpPort,secure:env.SMTP_SECURE?env.SMTP_SECURE==='true':smtpPort===465,
      user:env.SMTP_USER||undefined,password:env.SMTP_PASSWORD||undefined};
  }
  const googleClientId=env.GOOGLE_CLIENT_ID?.trim()||undefined;
  if (env.PLATFORM_EXTENSIONS_ENABLED && !['true','false'].includes(env.PLATFORM_EXTENSIONS_ENABLED)) throw new Error('PLATFORM_EXTENSIONS_ENABLED must be true or false');
  const platformEnabled = env.PLATFORM_EXTENSIONS_ENABLED === 'true';
  const accountEncryptionKey = env.ACCOUNT_ENCRYPTION_KEY || undefined;
  if (accountEncryptionKey && !/^[a-f0-9]{64}$/i.test(accountEncryptionKey)) throw new Error('ACCOUNT_ENCRYPTION_KEY must be 32 random bytes encoded as hex');
  if (platformEnabled && !accountEncryptionKey) throw new Error('Enabled platform extensions require ACCOUNT_ENCRYPTION_KEY');
  if(googleClientId&&!/^[a-z0-9._-]+\.apps\.googleusercontent\.com$/i.test(googleClientId))throw new Error('GOOGLE_CLIENT_ID must be a Google OAuth client ID');
  if (nodeEnv === 'production' && researchEnabled && (!ultraSearchUrl || !geminiConfigured)) {
    throw new Error('Enabled production research requires ULTRASEARCH_URL and GEMINI_API_KEY');
  }
  if (env.BILLING_ENABLED && !['true','false'].includes(env.BILLING_ENABLED)) throw new Error('BILLING_ENABLED must be true or false');
  const billingEnabled = env.BILLING_ENABLED === 'true';
  if(env.CREDITS_ENABLED && !['true','false'].includes(env.CREDITS_ENABLED))throw new Error('CREDITS_ENABLED must be true or false');
  const creditsEnabled=env.CREDITS_ENABLED==='true';
  const bachsEnvironment = env.BACHS_ENVIRONMENT || 'sandbox';
  if (!['sandbox','production'].includes(bachsEnvironment)) throw new Error('BACHS_ENVIRONMENT must be sandbox or production');
  const bachsValues = [env.BACHS_API_KEY,env.BACHS_WEBHOOK_SECRET,env.BACHS_ORGANIZATION_ID,env.BACHS_SUCCESS_URL,env.BACHS_CANCEL_URL];
  let bachs: { environment: 'sandbox'|'production'; apiKey:string; webhookSecret:string; organizationId:string; successUrl:string; cancelUrl:string } | undefined;
  if (bachsValues.some(Boolean) || billingEnabled) {
    if (!bachsValues.every(Boolean)) throw new Error('Set all Bachs credentials, organization and return URLs before enabling billing');
    if (!env.BACHS_API_KEY!.startsWith(bachsEnvironment==='sandbox'?'sk_sandbox_':'sk_live_')) throw new Error('BACHS_API_KEY does not match BACHS_ENVIRONMENT');
    if (env.BACHS_WEBHOOK_SECRET!.length < 16 || !/^acct_[a-zA-Z0-9_-]{1,200}$/.test(env.BACHS_ORGANIZATION_ID!)) throw new Error('Invalid Bachs webhook secret or organization ID');
    for (const value of [env.BACHS_SUCCESS_URL!,env.BACHS_CANCEL_URL!]) {
      try { const url=new URL(value); if(url.protocol!=='https:'||url.username||url.password||url.hash||url.hostname==='localhost'||isIP(url.hostname)||!url.hostname.includes('.'))throw new Error(); }
      catch { throw new Error('Bachs return URLs must be public HTTPS URLs without credentials or fragments'); }
    }
    bachs = {environment:bachsEnvironment as 'sandbox'|'production',apiKey:env.BACHS_API_KEY!,webhookSecret:env.BACHS_WEBHOOK_SECRET!,
      organizationId:env.BACHS_ORGANIZATION_ID!,successUrl:env.BACHS_SUCCESS_URL!,cancelUrl:env.BACHS_CANCEL_URL!};
  }
  return { nodeEnv, port, host, logLevel, databaseUrl, jwtSecret, redisUrl, cloudinary, uploadMaxBytes, workerConcurrency, reconcileIntervalMs,
    researchEnabled, ultraSearchUrl, geminiConfigured, startupTimeoutMs, shutdownTimeoutMs, requestTimeoutMs, trustProxy, smtp, googleClientId,
    creditsEnabled, billingEnabled, bachsEnvironment: bachsEnvironment as 'sandbox'|'production', bachs, platformEnabled, accountEncryptionKey, specialist };
}

export type AppConfig = ReturnType<typeof loadConfig>;

export function validateWorkerConfig(config: AppConfig) {
  if (!config.redisUrl) throw new Error('REDIS_URL is required to run the source-collection worker');
  if (config.researchEnabled && (!config.ultraSearchUrl || !config.geminiConfigured)) {
    throw new Error('Enabled worker research requires ULTRASEARCH_URL and GEMINI_API_KEY');
  }
}
