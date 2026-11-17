import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const script=readFileSync('scripts/asaas-hosted-pix-sandbox-smoke.mjs','utf8'),workflow=readFileSync('.github/workflows/asaas-hosted-pix-sandbox.yml','utf8');
test('sandbox smoke only creates then cancels unpaid Pix Checkout',()=>{
 assert.match(script,/ASAAS_MODE!=='sandbox'/);assert.match(script,/\$aact_hmlg_/);
 assert.match(script,/chargeTypes:\['DETACHED'\]/);
 assert.match(script,/billingTypes:\['PIX'\]/);
 assert.match(script,/\/cancel','POST'/);
 assert.doesNotMatch(script,/https:\/\/api\.asaas\.com\/v3/);
 assert.match(workflow,/environment: sandbox/);
});
