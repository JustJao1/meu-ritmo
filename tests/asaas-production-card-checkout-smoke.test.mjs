import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const p=readFileSync('scripts/asaas-production-card-checkout-smoke.mjs','utf8');
test('card readiness never enters card numbers or charges a payment',()=>{
 assert.match(p,/ASAAS_MODE!=='production'/);
 assert.match(p,/billingTypes:\['CREDIT_CARD'\]/);
 assert.match(p,/chargeTypes:\['RECURRENT'\]/);
 assert.match(p,/\/cancel','POST'/);
 assert.doesNotMatch(p,/creditCardToken|creditCardNumber|creditCardHolderInfo|ccv/i);
});
