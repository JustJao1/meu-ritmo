import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const folder=await mkdtemp(join(tmpdir(),'mr-asaas-card-'));
await build({entryPoints:['lib/asaas-hosted-card.ts'],outfile:join(folder,'card.mjs'),bundle:true,platform:'node',format:'esm'});
const {hostedCardCheckoutPayload}=await import(join(folder,'card.mjs'));
const defaults={
 orderId:'12345678-1234-4123-8123-123456789abc',
 customerId:'cus_ABC12345678',
 plan:'plus_month',
 amountCents:1990,
 nextDueDate:'2026-12-15 18:00:00',
 siteOrigin:'https://meuritmo.net/'
};
test('hosted card checkout requests recurring billing without ever handling card data',()=>{
 const p=hostedCardCheckoutPayload(defaults);
 assert.deepEqual(p.billingTypes,['CREDIT_CARD']);
 assert.deepEqual(p.chargeTypes,['RECURRENT']);
 assert.equal(p.subscription.cycle,'MONTHLY');
 assert.equal(p.externalReference,defaults.orderId);
 assert.equal(p.customer,defaults.customerId);
 assert.equal(p.items[0].value,19.90);
 assert.equal(p.callback.successUrl,'https://meuritmo.net/app?billing=awaiting_webhook');
 assert.equal(p.minutesToExpire,60);
 assert(!JSON.stringify(p).includes('creditCardToken'));
 assert(!JSON.stringify(p).includes('creditCardHolderInfo'));
 assert(!JSON.stringify(p).includes('ccv'));
});
test('yearly Pro uses yearly billing without weakening payment verification',()=>{
 const p=hostedCardCheckoutPayload({...defaults,plan:'pro_year',amountCents:19900});
 assert.equal(p.subscription.cycle,'YEARLY');
 assert.equal(p.items[0].value,199);
});
test('reject invalid order, amount, customer, date and callback origin',()=>{
 for(const override of [
  {orderId:'invalid'}, {customerId:'cus_'},{amountCents:0},
  {amountCents:19.5},{nextDueDate:'2026-02-30 12:00:00'},
  {siteOrigin:'http://meuritmo.net/'},
  {siteOrigin:'https://evil.example.com/path'}
 ])assert.throws(()=>hostedCardCheckoutPayload({...defaults,...override}),JSON.stringify(override));
});
after(async()=>rm(folder,{recursive:true,force:true}));
