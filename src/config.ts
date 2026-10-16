export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
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
  return { nodeEnv, port, host, logLevel, databaseUrl, jwtSecret, redisUrl, cloudinary, uploadMaxBytes, workerConcurrency, reconcileIntervalMs };
}

export type AppConfig = ReturnType<typeof loadConfig>;
