import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Writable } from 'node:stream';
import { createLogger } from '../src/logger.js';

function capture(level='trace') {
  let output='';
  const stream=new Writable({write(chunk,_encoding,done){output+=chunk.toString();done();}});
  return {logger:createLogger('test',level,stream),lines:()=>output.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line))};
}
test('shared logger emits structured component context and honors levels',()=>{
  const {logger,lines}=capture('warn');
  logger.info('Hidden');logger.child({component:'worker'}).warn({investigation_id:'fixture-id'},'Retry deferred');
  assert.equal(lines().length,1);assert.equal(lines()[0].level,'warn');assert.equal(lines()[0].component,'worker');
  assert.equal(lines()[0].service,'padicheck-backend');assert.equal(lines()[0].investigation_id,'fixture-id');assert.ok(Number.isFinite(Date.parse(lines()[0].time)));
  const silent=capture('silent');silent.logger.fatal('Hidden too');assert.deepEqual(silent.lines(),[]);
});
test('shared logger redacts secrets, request bodies and query parameters',()=>{
  const {logger,lines}=capture();
  logger.info({password:'SECRET_PASSWORD',token:'SECRET_TOKEN',nested:{id_token:'SECRET_GOOGLE'},
    headers:{authorization:'SECRET_AUTH','x-goog-api-key':'SECRET_KEY'},body:{code:'SECRET_OTP'},
    req:{method:'POST',url:'/v1/auth/register?secret=SECRET_QUERY',headers:{cookie:'SECRET_COOKIE'},body:{password:'SECRET_REQUEST'}}},'Safe operation');
  const value=lines()[0];assert.equal(value.password,'[REDACTED]');assert.equal(value.nested.id_token,'[REDACTED]');
  assert.equal(value.req.url,'/v1/auth/register');assert.equal(value.req.body,undefined);
  assert.ok(!JSON.stringify(value).includes('SECRET_'));
});
test('error serialization keeps safe failure codes and omits provider messages, causes and stacks',()=>{
  const {logger,lines}=capture();
  const error=Object.assign(new Error('SECRET_CONNECTION_STRING'),{code:'ECONNREFUSED',cause:new Error('SECRET_CAUSE')});
  logger.error({err:error,operation:'database_connect'},'Dependency failed');
  assert.deepEqual(lines()[0].err,{type:'Error',failure_code:'ECONNREFUSED'});assert.ok(!JSON.stringify(lines()).includes('SECRET_'));
});
