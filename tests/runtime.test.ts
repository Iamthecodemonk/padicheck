import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildApp } from '../src/app.js';
import { loadConfig, validateWorkerConfig } from '../src/config.js';
import { gracefulShutdown, deadline } from '../src/runtime/lifecycle.js';
import { apiRuntime } from '../src/runtime/api.js';
import { checkIntegrations, type IntegrationProbes } from '../src/runtime/integrations.js';
import { testDatabase } from './support/database.js';
import { memoryRevocations } from '../src/modules/auth/revocations.js';

const env={NODE_ENV:'test',LOG_LEVEL:'silent',DATABASE_URL:'postgres://unused:unused@localhost/test',JWT_SECRET:'test-secret-32-bytes-minimum-long-value'};

test('deployment configuration validates proxy boundaries, deadlines and enabled research',()=>{
  assert.equal(loadConfig(env).trustProxy,false);
  assert.deepEqual(loadConfig({...env,TRUST_PROXY:'127.0.0.1,10.0.0.0/8,::1/128'}).trustProxy,['127.0.0.1','10.0.0.0/8','::1/128']);
  for(const value of ['true','*','proxy.example.com','10.0.0.0/33','::1/129','127.0.0.1/','127.0.0.1,'])assert.throws(()=>loadConfig({...env,TRUST_PROXY:value}),/TRUST_PROXY/);
  for(const name of ['SHUTDOWN_TIMEOUT_MS','STARTUP_TIMEOUT_MS','REQUEST_TIMEOUT_MS']){
    assert.throws(()=>loadConfig({...env,[name]:'0'}),new RegExp(name));
    assert.throws(()=>loadConfig({...env,[name]:'Infinity'}),new RegExp(name));
  }
  assert.throws(()=>loadConfig({...env,NODE_ENV:'production',REDIS_URL:'redis://localhost:6379',RESEARCH_ENABLED:'true'}),/ULTRASEARCH_URL/);
  assert.throws(()=>validateWorkerConfig(loadConfig(env)),/REDIS_URL/);
  assert.throws(()=>validateWorkerConfig(loadConfig({...env,REDIS_URL:'redis://localhost:6379',RESEARCH_ENABLED:'true'})),/GEMINI_API_KEY/);
  validateWorkerConfig(loadConfig({...env,REDIS_URL:'redis://localhost:6379',RESEARCH_ENABLED:'true',ULTRASEARCH_URL:'http://localhost:8000',GEMINI_API_KEY:'fixture-key'}));
});

test('shutdown drains in order, continues after errors and runs once',async()=>{
  const trace:string[]=[];let release!:()=>void;
  const drain=new Promise<void>(resolve=>{release=resolve;});
  const shutdown=gracefulShutdown({timeoutMs:1000,steps:[
    {name:'active_jobs',async close(){trace.push('draining');await drain;trace.push('drained');}},
    {name:'queue',async close(){throw new Error('SECRET_DRIVER_ERROR');}},
    {name:'database',async close(){trace.push('database_closed');}},
  ],onError:name=>trace.push(name)});
  const first=shutdown();assert.equal(shutdown(),first);
  assert.deepEqual(trace,['draining']);release();await first;
  assert.deepEqual(trace,['draining','drained','queue','database_closed']);
});

test('startup and drain deadlines are bounded',async()=>{
  await assert.rejects(deadline(new Promise(()=>{}),20),/deadline/);
  let forced=0;let release!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  const shutdown=gracefulShutdown({timeoutMs:20,steps:[{name:'pending',close:()=>pending}],onError:()=>{},forceExit:()=>{forced++;}});
  const closing=shutdown();await new Promise(resolve=>setTimeout(resolve,50));assert.equal(forced,1);release();await closing;
});

test('integration checks distinguish missing configuration from actual failures and sanitize errors',async()=>{
  const calls:string[]=[];
  const probes:IntegrationProbes={database:async()=>{calls.push('database');},redis:async()=>{throw new Error('SECRET_CONNECTION_STRING');},
    cloudinary:async()=>{},ultrasearch:async()=>{},gemini:async()=>{},research_registry:async()=>{},smtp:async()=>{},google:async()=>{},billing_schema:async()=>{}};
  const results=await checkIntegrations(loadConfig(env),probes);
  assert.deepEqual(calls,['database']);assert.equal(results.find(result=>result.name==='gemini')!.status,'unconfigured');
  assert.equal(results.find(result=>result.name==='research_registry')!.status,'disabled');
  const failed=await checkIntegrations(loadConfig({...env,REDIS_URL:'redis://localhost:6379'}),probes);
  assert.equal(failed.find(result=>result.name==='redis')!.status,'failed');assert.ok(!JSON.stringify(failed).includes('SECRET'));
});

test('API readiness, proxy trust, production startup and HTTP draining',async t=>{
  const {db}=await testDatabase();
  const config=loadConfig(env);
  try{
    await t.test('forwarded addresses cannot bypass rate limits without a trusted proxy',async()=>{
      for(const trusted of [false,true]){
        const app=buildApp(loadConfig({...env,...(trusted?{TRUST_PROXY:'127.0.0.1'}:{})}),db);
        app.get('/inspect-ip',async request=>({ip:request.ip}));
        try{
          const response=await app.inject({url:'/inspect-ip',remoteAddress:'127.0.0.1',headers:{'x-forwarded-for':'203.0.113.7'}});
          assert.equal(response.json().ip,trusted?'203.0.113.7':'127.0.0.1');
          const untrusted=await app.inject({url:'/inspect-ip',remoteAddress:'198.51.100.1',headers:{'x-forwarded-for':'203.0.113.7'}});
          assert.equal(untrusted.json().ip,'198.51.100.1');
        }finally{await app.close();}
      }
    });
    const researchConfig=loadConfig({...env,REDIS_URL:'redis://unused:6379',RESEARCH_ENABLED:'true',ULTRASEARCH_URL:'http://unused:8000',GEMINI_API_KEY:'fixture-key'});
    const revocations=memoryRevocations();
    const app=buildApp(researchConfig,db,{revocations,jobs:{async ping(){},async enqueue(){return 'waiting';},async close(){}}});
    try{
      await t.test('enabled research fails readiness until registry routes and tools are configured',async()=>{
        assert.equal((await app.inject('/ready')).statusCode,503);assert.equal((await app.inject('/health')).statusCode,200);
        const provider=(await db.query("INSERT INTO ai_providers (provider_code,display_name,credential_secret_ref) VALUES ('gemini','Gemini','env:GEMINI_API_KEY') RETURNING provider_id")).rows[0]!.provider_id;
        const model=(await db.query("INSERT INTO ai_models (provider_id,provider_model_id,display_name) VALUES ($1,'fixture-model','Fixture') RETURNING model_id",[provider])).rows[0]!.model_id;
        const agent=(await db.query("INSERT INTO ai_agents (agent_code,display_name,instructions_template) VALUES ('fixture','Fixture','Use evidence') RETURNING agent_id")).rows[0]!.agent_id;
        const task=(await db.query("INSERT INTO ai_task_types (task_code,display_name) VALUES ('investigation_analysis','Analysis') RETURNING task_id")).rows[0]!.task_id;
        await db.query('INSERT INTO ai_task_assignments (task_id,agent_id,model_id) VALUES ($1,$2,$3)',[task,agent,model]);
        for(const code of ['ultrasearch_search','public_url_fetch','pdf_extract']){
          const tool=(await db.query("INSERT INTO ai_tools (tool_code,display_name,tool_type) VALUES ($1,$1,'internal') RETURNING tool_id",[code])).rows[0]!.tool_id;
          await db.query('INSERT INTO ai_agent_tools (agent_id,tool_id) VALUES ($1,$2)',[agent,tool]);
        }
        const ready=await app.inject('/ready');assert.equal(ready.statusCode,200,ready.body);assert.equal(ready.headers['cache-control'],'no-store');
        await db.query("UPDATE ai_tools SET status='disabled' WHERE tool_code='pdf_extract'");
        assert.equal((await app.inject('/ready')).statusCode,503);
      });
      await t.test('production API refuses to listen when dependencies are not ready',async()=>{
        const runtime=apiRuntime(app,{...researchConfig,nodeEnv:'production',port:0});
        await assert.rejects(runtime.start(),/startup failed/);assert.equal(app.server.listening,false);
      });
    }finally{await app.close();await revocations.close();}
    await t.test('real HTTP startup and shutdown drain an active request',async()=>{
      const api=buildApp(config,db);let release!:()=>void;let entered!:()=>void;
      const ready=new Promise<void>(resolve=>{entered=resolve;});const hold=new Promise<void>(resolve=>{release=resolve;});
      api.get('/drain-test',async()=>{entered();await hold;return {finished:true};});
      const runtime=apiRuntime(api,{...config,port:0});
      try{
        await runtime.start();const address=api.server.address();assert.ok(address&&typeof address==='object');
        const base=`http://127.0.0.1:${address.port}`;
        const health=await fetch(base+'/health',{signal:AbortSignal.timeout(5000)});
        assert.equal(health.status,200);await health.json();
        const request=fetch(base+'/drain-test',{signal:AbortSignal.timeout(5000)});
        await deadline(ready,5000);let closed=false;
        const closing=runtime.shutdown().then(()=>{closed=true;});
        await new Promise(resolve=>setTimeout(resolve,20));assert.equal(closed,false);
        release();const response=await request;assert.equal(response.headers.get('connection'),'close');
        assert.deepEqual(await response.json(),{finished:true});await closing;
        assert.equal(api.server.listening,false);
      }finally{release();await runtime.shutdown();}
    });
  }finally{await db.close();}
});

test('worker process rejects missing Redis before connecting and logs no credentials',async()=>{
  const run=promisify(execFile);
  await assert.rejects(run(process.execPath,['--import','tsx','src/workers/source-collection.ts'],{
    cwd:process.cwd(),timeout:10000,env:{...process.env,...env,LOG_LEVEL:'info',REDIS_URL:'',RESEARCH_ENABLED:'false',
      DATABASE_URL:'postgres://SECRET_USER:SECRET_PASSWORD@127.0.0.1:1/unavailable',CLOUDINARY_CLOUD_NAME:'',CLOUDINARY_API_KEY:'',CLOUDINARY_API_SECRET:''},
  }),(error:unknown)=>{
    const result=error as {code?:number;stdout?:string;stderr?:string};
    assert.equal(result.code,1);assert.match(result.stderr??'',/configuration or initialization failed/);
    assert.ok(!((result.stdout??'')+(result.stderr??'')).includes('SECRET'));return true;
  });
});
