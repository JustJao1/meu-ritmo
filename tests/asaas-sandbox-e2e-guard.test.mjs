import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync('scripts/asaas-sandbox-e2e.mjs','utf8');
const workflow=readFileSync('.github/workflows/asaas-homologacao.yml','utf8');
test('no Asaas sandbox test uses real production endpoints or missing mode guards',()=>{
 assert.match(script,/https:\/\/api-sandbox\.asaas\.com\/v3/);
 assert.doesNotMatch(script,/https:\/\/api\.asaas\.com\/v3/);
 assert.match(script,/e\.ASAAS_MODE!=='sandbox'/);
 assert.match(script,/e\.ASAAS_API_KEY\?\.startsWith\('\$aact_hmlg_'\)/);
 assert.match(script,/e\.SANDBOX_D1_DATABASE_ID===e\.PRODUCTION_D1_DATABASE_ID/);
 assert.match(script,/database\.result\?\.name!=='meu-ritmo-asaas-sandbox'/);
});
test('test payer is synthetic and does not send Asaas notifications',()=>{
 assert.match(script,/name:'Meu Ritmo Homologacao Sandbox'/);
 assert.match(script,/notificationDisabled:true/);
 assert.match(script,/notificationDisabled:true/);
 assert.match(script,/email:'pagador@exemplo\.test'/);
 assert.doesNotMatch(script,/@(?:gmail|hotmail|outlook|yahoo)\./i);
 assert.match(script,/\/sandbox\/payment\//);
 assert.match(script,/\['CONFIRMED','RECEIVED'\]/);
 assert.match(script,/Webhook com autenticação incorreta/);
});
test('workflow uses the isolated sandbox environment and does not expose production mode',()=>{
 assert.match(workflow,/environment: sandbox/g);
 assert.match(workflow,/needs: \[asaas_sandbox\]/);
 assert.match(workflow,/SANDBOX_D1_DATABASE_ID: \$\{\{ vars\.SANDBOX_D1_DATABASE_ID \}\}/);
 assert.match(workflow,/SANDBOX_ASAAS_WEBHOOK_TOKEN: \$\{\{ secrets\.SANDBOX_ASAAS_WEBHOOK_TOKEN \}\}/);
 assert.doesNotMatch(workflow,/ASAAS_MODE:\s*production/);
});
