import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const script='scripts/deploy-sandbox.mjs';
const workflow=readFileSync('.github/workflows/deploy-sandbox.yml','utf8');
const source=readFileSync(script,'utf8');
const uuid='11111111-2222-4333-8444-555555555555';
const base={
 CLOUDFLARE_ACCOUNT_ID:'test',
 CLOUDFLARE_API_TOKEN:'test',
 SANDBOX_D1_DATABASE_ID:uuid,
 PRODUCTION_D1_DATABASE_ID:'99999999-2222-4333-8444-555555555555',
 SANDBOX_SUPABASE_URL:'https://sandbox-ritmo.supabase.co',
 PRODUCTION_SUPABASE_URL:'https://production-ritmo.supabase.co',
 SANDBOX_SUPABASE_PUBLISHABLE_KEY:'test-publishable',
 SANDBOX_SESSION_ENCRYPTION_KEY:'a'.repeat(44),
 PRODUCTION_SESSION_ENCRYPTION_KEY:'b'.repeat(44),
 ASAAS_API_KEY:'$aact_hmlg_test',
 ASAAS_MODE:'sandbox',
 ASAAS_WEBHOOK_READY:'false',
 ASAAS_BILLING_ENABLED:'false'
};
function run(overrides={}){
 return spawnSync(process.execPath,[script],{
  encoding:'utf8',
  env:{...process.env,...base,...overrides}
 });
}
test('sandbox workflow is manual and bound only to the sandbox environment',()=>{
 assert.match(workflow,/workflow_dispatch:/);
 assert.match(workflow,/environment: sandbox/);
 assert.doesNotMatch(workflow,/branches:\s*\[main\]/);
 assert.match(workflow,/SANDBOX_D1_DATABASE_ID/);
 assert.match(workflow,/SANDBOX_SUPABASE_URL/);
 assert.match(workflow,/ASAAS_WEBHOOK_TOKEN:\s*\$\{\{ secrets\.SANDBOX_ASAAS_WEBHOOK_TOKEN \}\}/);
 assert.doesNotMatch(workflow,/ASAAS_WEBHOOK_TOKEN:\s*\$\{\{ secrets\.ASAAS_WEBHOOK_TOKEN \}\}/);
 assert.doesNotMatch(workflow,/run: npm run deploy\s*$/m);
});
test('deployment refuses any production D1 ID before touching Cloudflare',()=>{
 const r=run({SANDBOX_D1_DATABASE_ID:base.PRODUCTION_D1_DATABASE_ID});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/D1 de testes precisa ter um ID real e diferente/);
});
test('deployment refuses shared Supabase project and live API key',()=>{
 const shared=run({SANDBOX_SUPABASE_URL:base.PRODUCTION_SUPABASE_URL});
 assert.notEqual(shared.status,0);
 assert.match(shared.stderr,/Supabase de testes separado/);
 const live=run({ASAAS_API_KEY:'$aact_prod_test'});
 assert.notEqual(live.status,0);
 assert.match(live.stderr,/somente chave e ambiente Asaas Sandbox/);
});
test('webhook ready and checkout cannot be enabled without a test token',()=>{
 const r=run({ASAAS_WEBHOOK_READY:'true',ASAAS_WEBHOOK_TOKEN:''});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/Webhook marcado como pronto sem token/);
});
test('worker name is distinct and inherited routing is removed',()=>{
 assert.match(source,/name='meu-ritmo-asaas-sandbox'/);
 assert.match(source,/delete generated\.route;/);
 assert.match(source,/delete generated\.routes;/);
 assert.match(source,/generated\.workers_dev=true;/);
 assert.match(source,/secret','bulk','--name',name/);
});
