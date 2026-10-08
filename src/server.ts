import 'dotenv/config';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = buildApp(config);
let closing = false;

async function shutdown() {
  if (closing) return;
  closing = true;
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  try {
    await app.close();
  } catch (error) {
    app.log.error(error, 'Shutdown failed');
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
  }
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error, 'Server startup failed');
  process.exitCode = 1;
  await app.close();
}
