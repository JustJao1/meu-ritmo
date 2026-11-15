import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const dir=await mkdtemp(join(tmpdir(),'ritmo-asaas-probe-'));
const config={mode:'sandbox',apiReady:false,keyMatchesMode:false,key:undefined,webhookReady:false,enabled:false};
let requests=0;
globalThis.__probeTest={config,error:null,requestCount:()=>requests,env:{
 ASAAS_MODE:'sandbox',ASAAS_BILLING_ENABLED:'false',
 DB:{prepare:()=>({async first(){return null}})}
}};
const mocks={name:'mock-probe-dependencies',setup(api){
 api.onResolve({filter:/^cloudflare:workers$|lib\/asaas$|lib\/entitlements$|lib\/admin-access$|(?:^|\/)session$/},args=>({namespace:'probe',path:args.path}));
 api.onLoad({filter:/.*/,namespace:'probe'},args=>{
  if(args.path==='cloudflare:workers')return {loader:'js',contents:'export const env=globalThis.__probeTest.env;'};
  if(args.path.endsWith('lib/asaas'))return {loader:'js',contents:
   'export const asaasConfig=()=>globalThis.__probeTest.config; export const asaasRequest=async()=>{globalThis.__probeTest.requested=true; if(globalThis.__probeTest.error)throw globalThis.__probeTest.error;return {data:[]};};'
  };
  if(args.path.endsWith('lib/entitlements'))return {loader:'js',contents:'export const EARLY_ACCESS_ACTIVE=true;'};
  if(args.path.endsWith('lib/admin-access'))return {loader:'js',contents:"export const appRole=async()=> 'owner';"};
  return {loader:'js',contents:"export const getUser=async()=>({userId:'owner-user',email:'owner@example.test'});"};
 });
}};
await build({entryPoints:['app/api/billing/status/route.ts'],outfile:join(dir,'probe.mjs'),bundle:true,format:'esm',platform:'node',plugins:[mocks]});
const {GET}=await import(join(dir,'probe.mjs'));
const probe=async()=>{
 const response=await GET(new Request('https://meuritmo.net/api/billing/status?diagnostic=1&probe=1'));
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 const body=await response.json();
 assert.equal(body.configured,false);
 assert.equal(body.diagnostic.apiReachable,false);
 return body.diagnostic;
};

test('missing key is reported accurately without a network request',async()=>{
 Object.assign(config,{apiReady:false,keyMatchesMode:false,key:undefined});
 Object.assign(globalThis.__probeTest.env,{ASAAS_API_KEY:undefined});
 const diagnostic=await probe();
 assert.equal(diagnostic.apiIssue,'missing_key');
 assert.equal(globalThis.__probeTest.requested,undefined);
});
test('production key used in sandbox is diagnosed before any API request',async()=>{
 Object.assign(config,{apiReady:false,keyMatchesMode:false,key:'$aact_prod_secret'});
 globalThis.__probeTest.env.ASAAS_API_KEY='$aact_prod_secret';
 const diagnostic=await probe();
 assert.equal(diagnostic.apiIssue,'environment_mismatch');
 assert.equal(globalThis.__probeTest.requested,undefined);
 assert(!JSON.stringify(diagnostic).includes('$aact_prod_secret'));
});
test('HTTP errors are classified without disclosing keys or provider payloads',async()=>{
 Object.assign(config,{apiReady:true,keyMatchesMode:true,key:'sandbox-key'});
 globalThis.__probeTest.env.ASAAS_API_KEY='sandbox-key';
 for(const [code,expected] of [[401,'unauthorized'],[403,'forbidden'],[429,'rate_limited'],[500,'provider_error']]){
  globalThis.__probeTest.error=new Error('Asaas não concluiu a solicitação ('+code+').');
  const diagnostics=await probe();
  assert.equal(diagnostics.apiIssue,expected);
  assert.equal(diagnostics.apiHttpStatus,code);
  assert(!JSON.stringify(diagnostics).includes('sandbox-key'));
 }
 globalThis.__probeTest.error=new Error('Tempo limite na comunicação com Asaas.');
 assert.equal((await probe()).apiIssue,'timeout');
 globalThis.__probeTest.error=new Error('Network error');
 assert.equal((await probe()).apiIssue,'network_error');
});
test('successful API call is marked as reachable only for the expected response',async()=>{
 globalThis.__probeTest.error=null;
 const response=await GET(new Request('https://meuritmo.net/api/billing/status?diagnostic=1&probe=1'));
 const body=await response.json();
 assert.equal(body.diagnostic.apiReachable,true);
 assert.equal(body.diagnostic.apiIssue,undefined);
});
after(async()=>{delete globalThis.__probeTest;await rm(dir,{recursive:true,force:true});});
