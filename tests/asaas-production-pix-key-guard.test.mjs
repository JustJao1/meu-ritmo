import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const source=readFileSync('scripts/asaas-register-production-pix-key.mjs','utf8');
const workflow=readFileSync('.github/workflows/asaas-register-production-pix-key.yml','utf8');
test('production Pix provisioning requires approved environment and never outputs key values',()=>{
 assert.match(source,/ASAAS_MODE!=='production'/);
 assert.match(source,/\$aact_prod_/);
 assert.match(source,/active>0/);assert.match(source,/pending>0/);
 assert.match(source,/\{type:'EVP'\}/);
 assert.doesNotMatch(source,/console\.log\(created\.result/);
 assert.match(workflow,/environment: production/);
});
