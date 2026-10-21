import type { AppConfig } from '../config.js';
import type { Database } from '../database/index.js';
import { databaseReadiness, researchReadiness } from './readiness.js';
import { redisRevocations } from '../modules/auth/revocations.js';
import { investigationJobs } from '../adapters/investigation-jobs.js';
import { providerJson } from '../adapters/provider-http.js';
import { ultraSearch } from '../adapters/ultrasearch.js';
import { deadline } from './lifecycle.js';
import { smtpMailer } from '../adapters/smtp.js';
import { billingReadiness } from '../modules/billing/service.js';

export type IntegrationName = 'database'|'redis'|'cloudinary'|'ultrasearch'|'gemini'|'research_registry'|'smtp'|'google'|'billing_schema';
export type IntegrationResult = { name:IntegrationName; status:'passed'|'failed'|'unconfigured'|'disabled' };
export type IntegrationProbes = Record<IntegrationName,()=>Promise<unknown>>;

export function integrationProbes(config:AppConfig,db:Database,env:NodeJS.ProcessEnv=process.env):IntegrationProbes {
  return {
    database:()=>databaseReadiness(db),
    async redis(){
      const revocations=redisRevocations(config.redisUrl!);
      const queue=investigationJobs(config.redisUrl!);
      try{await revocations.ping();await queue.ping();}
      finally{
        const results=await deadline(Promise.allSettled([revocations.close(),queue.close()]),5000);
        if(results.some(result=>result.status==='rejected'))throw new Error('Redis cleanup failed');
      }
    },
    async cloudinary(){
      const cloud=config.cloudinary!;
      const result=await providerJson(`https://api.cloudinary.com/v1_1/${cloud.cloudName}/ping`,{
        headers:{Authorization:`Basic ${Buffer.from(`${cloud.apiKey}:${cloud.apiSecret}`).toString('base64')}`},
      });
      if(result.status!=='ok')throw new Error('Cloudinary ping failed');
    },
    async ultrasearch(){
      // A synthetic public query only: never send application records or enable
      // the upstream crawler/AI overview as part of a connectivity probe.
      await ultraSearch(config.ultraSearchUrl!,env)('example.com',1,env.ULTRASEARCH_API_KEY?'env:ULTRASEARCH_API_KEY':null);
    },
    async gemini(){
      const result=await providerJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',{
        headers:{'x-goog-api-key':env.GEMINI_API_KEY!},
      });
      if(!Array.isArray(result.models)||!result.models.length)throw new Error('Gemini model metadata unavailable');
      // Check actual registered routes when enabled, without generating content.
      if(config.researchEnabled){
        const {researchAssignments}=await import('../modules/research/registry.js');
        for(const assignment of await researchAssignments(db)){
          const model=assignment.provider_model_id.replace(/^models\//,'');
          if(!/^[a-z0-9._-]{1,200}$/i.test(model))throw new Error('Unsupported model identifier');
          const info=await providerJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,{
            headers:{'x-goog-api-key':env.GEMINI_API_KEY!},
          });
          if(!Array.isArray(info.supportedGenerationMethods)||!info.supportedGenerationMethods.includes('generateContent'))throw new Error('Registered model does not support generation');
        }
      }
    },
    research_registry:()=>researchReadiness(db,config,env),
    billing_schema:()=>billingReadiness(db),
    async smtp(){const mailer=smtpMailer(config.smtp!);try{await mailer.verify();}finally{mailer.close();}},
    async google(){
      const metadata=await providerJson('https://accounts.google.com/.well-known/openid-configuration',{});
      if(metadata.issuer!=='https://accounts.google.com')throw new Error('Google identity metadata unavailable');
    },
  };
}

export async function checkIntegrations(config:AppConfig,probes:IntegrationProbes):Promise<IntegrationResult[]> {
  const enabled:Record<IntegrationName,boolean>={database:true,redis:!!config.redisUrl,cloudinary:!!config.cloudinary,
    ultrasearch:!!config.ultraSearchUrl,gemini:config.geminiConfigured,research_registry:config.researchEnabled,smtp:!!config.smtp,google:!!config.googleClientId,billing_schema:config.billingEnabled};
  const results:IntegrationResult[]=[];
  for(const name of Object.keys(enabled) as IntegrationName[]){
    if(!enabled[name]){results.push({name,status:['research_registry','billing_schema'].includes(name)?'disabled':'unconfigured'});continue;}
    try{await probes[name]();results.push({name,status:'passed'});}
    catch{results.push({name,status:'failed'});}
  }
  return results;
}
