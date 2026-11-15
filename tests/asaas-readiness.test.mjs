import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {build} from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'ritmo-asaas-'));
globalThis.__asaasTestEnv={};
const mock={name:'cloudflare-env',setup(bundle){
 bundle.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cf',namespace:'asaas-test'}));
 bundle.onLoad({filter:/.*/,namespace:'asaas-test'},()=>({contents:'export const env=globalThis.__asaasTestEnv;',loader:'js'}));
}};
await build({entryPoints:['lib/asaas.ts','lib/brazil-tax-id.ts'],outdir:dir,bundle:true,platform:'node',format:'esm',plugins:[mock],outExtension:{'.js':'.mjs'}});
const {asaasConfig}=await import(join(dir,'asaas.mjs'));
const {validBrazilTaxId}=await import(join(dir,'brazil-tax-id.mjs'));
const e=globalThis.__asaasTestEnv;

test('Asaas key environment mismatch prevents use of live credentials in Sandbox',()=>{
 Object.assign(e,{ASAAS_MODE:'sandbox',ASAAS_API_KEY:'$aact_prod_fake',ASAAS_WEBHOOK_TOKEN:'a'.repeat(48),ASAAS_WEBHOOK_READY:'true',ASAAS_BILLING_ENABLED:'true'});
 assert.equal(asaasConfig().apiReady,false);
 assert.equal(asaasConfig().enabled,false);
 e.ASAAS_MODE='production';e.ASAAS_API_KEY='$aact_hmlg_fake';
 assert.equal(asaasConfig().apiReady,false);
 assert.equal(asaasConfig().enabled,false);
 e.ASAAS_API_KEY='$aact_prod_fake';
 assert.equal(asaasConfig().apiReady,true);
 assert.equal(asaasConfig().enabled,true);
});
test('Webhooks remain available when new subscriptions are suspended',()=>{
 Object.assign(e,{ASAAS_MODE:'sandbox',ASAAS_API_KEY:'$aact_hmlg_fake',ASAAS_WEBHOOK_TOKEN:'a'.repeat(48),ASAAS_WEBHOOK_READY:'true',ASAAS_BILLING_ENABLED:'false'});
 assert.equal(asaasConfig().webhookReady,true);
 assert.equal(asaasConfig().enabled,false);
 e.ASAAS_WEBHOOK_TOKEN='short';
 assert.equal(asaasConfig().webhookReady,false);
 e.ASAAS_WEBHOOK_TOKEN='a'.repeat(48);
 e.ASAAS_WEBHOOK_TOKEN+=' ';
 assert.equal(asaasConfig().webhookReady,false);
});
test('new payer CPF and CNPJ numbers require valid check digits',()=>{
 assert.equal(validBrazilTaxId('529.982.247-25'),true);
 assert.equal(validBrazilTaxId('11.222.333/0001-81'),true);
 for(const value of ['00000000000','12345678900','52998224726','11222333000182','99999999999999','','123'])
  assert.equal(validBrazilTaxId(value),false,value);
});
after(async()=>{delete globalThis.__asaasTestEnv;await rm(dir,{recursive:true,force:true})});
