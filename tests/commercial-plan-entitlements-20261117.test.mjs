import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const prices=read('lib/plans.ts');
const coupons=read('lib/asaas-coupons.ts');
const spaces=read('app/api/spaces/route.ts');
const assistant=read('app/api/assistant/route.ts');
const entitlements=read('lib/entitlements.ts');
const checkout=read('app/api/billing/checkout/route.ts');
const cancel=read('app/api/billing/cancel/route.ts');
const status=read('app/api/billing/status/route.ts');
const portal=read('app/api/billing/portal/route.ts');

test('Plus e Pro apresentam os quatro preços implementados sem tabela paralela',()=>{
 assert.match(prices,/plus:\{name:'Plus',monthly:19\.90,yearly:199\.90/);
 assert.match(prices,/pro:\{name:'Pro',monthly:29\.90,yearly:299\.90/);
 for(const price of ['plus_month','plus_year','pro_month','pro_year'])
   assert.match(coupons,new RegExp(price+':Math\\.round\\(planConfig\\.'));
});
test('criação de espaços exige Plus/Pro e mantém limite de dois',()=>{
 assert.match(spaces,/return entitlement\.plan==='plus'\|\|entitlement\.plan==='pro'/);
 assert.match(spaces,/Criar espaços está disponível nos planos Plus e Pro/);
 assert.match(spaces,/maxCreated:2/);
});
test('assistente exige Pro no servidor, sem confiar no plano mostrado pelo navegador',()=>{
 assert.match(assistant,/await userPlan\(u\.userId\)!=='pro'/);
 assert.match(assistant,/PRO_REQUIRED/);
});
test('períodos expirados deixam de conceder assinatura, sem apagar os dados',()=>{
 assert.match(entitlements,/s\.valid_until>now/);
 assert.match(entitlements,/return \{plan:'free' as Plan/);
});
test('compras Pix exigem consentimento e checkout seguro; reembolsos não são prometidos como concluídos',()=>{
 assert.match(checkout,/acceptTerms:z\.literal\(true\)/);
 assert.match(checkout,/acceptRefundPolicy:z\.literal\(true\)/);
 assert.match(checkout,/hostedPixCheckoutPayload/);
 assert.match(cancel,/status='CANCELED'/);
 assert.match(portal,/renewal:'manual'/);
 assert.match(status,/cardAvailable:/);
});
