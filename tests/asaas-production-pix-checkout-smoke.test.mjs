import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const script=readFileSync('scripts/asaas-production-pix-checkout-smoke.mjs','utf8');
const flow=readFileSync('.github/workflows/asaas-production-pix-checkout-smoke.yml','utf8');
test('hosted Pix production check is an unpaid checkout and immediately canceled',()=>{
 assert.match(script,/ASAAS_MODE!=='production'/);
 assert.match(script,/\$aact_prod_/);
 assert.match(script,/billingTypes:\['PIX'\]/);
 assert.match(script,/chargeTypes:\['DETACHED'\]/);
 assert.match(script,/\/cancel','POST'/);
 assert.match(script,/value:5\.00/);
 assert.match(flow,/environment: production/);
 assert.doesNotMatch(script,/https:\/\/api-sandbox\.asaas\.com/);
});
