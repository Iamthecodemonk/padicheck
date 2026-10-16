import 'dotenv/config';
import { logger as rootLogger } from '../src/logger.js';
import { loadConfig } from '../src/config.js';
import { createDatabase, type Database } from '../src/database/index.js';
import { checkIntegrations, integrationProbes } from '../src/runtime/integrations.js';
const logger = rootLogger.child({ component: 'check-integrations' });


let db:Database|undefined;
const fuse=setTimeout(()=>{logger.error('Integration checks exceeded their deadline');process.exit(1);},180000);
fuse.unref();
try{
  const args=process.argv.slice(2);
  if(args.some(arg=>arg!=='--require-all'))throw new Error('Unsupported check option');
  const config=loadConfig();
  db=createDatabase(config.databaseUrl);
  const results=await checkIntegrations(config,integrationProbes(config,db));
  const complete=results.every(result=>result.status==='passed');
  process.stdout.write(JSON.stringify({fully_configured:complete,checks:results},null,2) + '\n');
  if(results.some(result=>result.status==='failed')||(args.includes('--require-all')&&!complete))process.exitCode=1;
}catch{logger.error('Integration checks could not run; check environment configuration and options');process.exitCode=1;}
finally{try{if(db)await db.close();}finally{clearTimeout(fuse);}}
