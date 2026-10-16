import 'dotenv/config';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { apiRuntime } from './runtime/api.js';

async function main() {
  const config = loadConfig();
  const app = buildApp(config);
  const runtime=apiRuntime(app,config);
  process.once('SIGINT',()=>void runtime.shutdown());
  process.once('SIGTERM',()=>void runtime.shutdown());
  await runtime.start();
}
await main().catch(()=>{console.error('API configuration or initialization failed');process.exitCode=1;});
