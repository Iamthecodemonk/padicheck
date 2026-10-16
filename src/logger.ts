import pino, { type DestinationStream, type LevelWithSilent } from 'pino';

const levels = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);
const secrets = ['password', 'password_hash', 'code', 'otp', 'code_digest', 'token', 'token_hash', 'access_token', 'refresh_token',
  'id_token', 'nonce', 'secret', 'apiKey', 'api_key', 'apiSecret', 'api_secret', 'jwtSecret', 'databaseUrl', 'redisUrl',
  'connectionString', 'authorization', 'Authorization', 'cookie', 'Cookie', 'credential_secret_ref'];

export function createLogger(component: string, level: string = process.env.LOG_LEVEL ?? 'info', destination?: DestinationStream) {
  return pino({
    level: (levels.has(level) ? level : 'info') as LevelWithSilent,
    base: { service: 'padicheck-backend', component },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: label => ({ level: label }) },
    redact: {
      paths: [...secrets.flatMap(key => [key, `*.${key}`, `*.*.${key}`]),
        'body', 'req.body', 'request.body', 'req.headers', 'res.headers["set-cookie"]',
        'headers["x-goog-api-key"]', 'headers["set-cookie"]'],
      censor: '[REDACTED]',
    },
    serializers: {
      req: (request: { method?: string; url?: string; hostname?: string; ip?: string }) => ({
        method: request.method, url: request.url?.split(/[?#]/)[0], hostname: request.hostname, remoteAddress: request.ip,
      }),
      // Raw driver/provider messages, stacks and causes can contain credentials.
      // Log an operation name and IDs alongside an error; never its raw body.
      err: (error: { code?: unknown } | null) => ({ type: 'Error',
        ...(typeof error?.code === 'string' && (/^[0-9A-Z]{5}$/.test(error.code) ||
          ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'EACCES', 'ENOSPC'].includes(error.code)) ? { failure_code: error.code } : {}),
      }),
    },
  }, destination ?? pino.destination({ dest: 2, sync: true }));
}

export const logger = createLogger('app');
