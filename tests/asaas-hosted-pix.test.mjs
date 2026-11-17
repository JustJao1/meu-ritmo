import {test,after} from 'node:test';import assert from 'node:assert/strict';
import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
const dir=await mkdtemp(join(tmpdir(),'mr-asaas-pix-hosted-'));
await build({entryPoints:['lib/asaas-hosted-pix.ts'],outfile:join(dir,'pix.mjs'),bundle:true,platform:'node',format:'esm'});
const {hostedPixCheckoutPayload,paidThrough,hostedCheckoutUrl}=await import(join(dir,'pix.mjs'));
const args={orderId:'12345678-1234-4123-8123-123456789abc',customerId:'cus_TEST12345',plan:'plus_month',amountCents:1990,siteOrigin:'https://meuritmo.net/'};
test('Pix uses detached checkout linked to the authenticated customer and order',()=>{
 const data=hostedPixCheckoutPayload(args);
 assert.deepEqual(data.billingTypes,['PIX']);assert.deepEqual(data.chargeTypes,['DETACHED']);
 assert.equal(data.customer,args.customerId);assert.equal(data.externalReference,args.orderId);
 assert.equal(data.items[0].value,19.9);assert.equal(data.minutesToExpire,60);
 assert(!JSON.stringify(data).includes('creditCard'));
 assert.equal(hostedCheckoutUrl(args.orderId),'https://asaas.com/checkoutSession/show?id='+args.orderId);
});
test('hosted Pix does not accept forged customers, amounts or callbacks',()=>{
 for(const override of [{orderId:'x'},{customerId:'cus_'},{amountCents:0},{amountCents:499},{amountCents:19.9},{siteOrigin:'https://attacker.invalid/'},{siteOrigin:'http://meuritmo.net/'}])
  assert.throws(()=>hostedPixCheckoutPayload({...args,...override}));
});
test('the monthly and yearly access periods account for calendar boundaries',()=>{
 assert.equal(new Date(paidThrough(Date.parse('2026-01-31T12:00:00Z')/1000,'plus_month')*1000).toISOString(),'2026-02-28T12:00:00.000Z');
 assert.equal(new Date(paidThrough(Date.parse('2024-02-29T12:00:00Z')/1000,'pro_year')*1000).toISOString(),'2025-02-28T12:00:00.000Z');
});
after(async()=>rm(dir,{recursive:true,force:true}));
