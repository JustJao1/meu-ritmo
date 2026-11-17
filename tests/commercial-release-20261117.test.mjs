import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(path,'utf8');
const deploy=read('.github/workflows/deploy.yml');
const audit=read('.github/workflows/asaas-production-audit.yml');
const screen=read('app/ritmo.tsx');
const languages=read('components/language-selector.tsx');
const legal=read('components/legal-page.tsx');
const legalLanguages=read('components/legal-localized-text.tsx');
const pix=read('lib/asaas-hosted-pix.ts');
const checkout=read('app/api/billing/checkout/route.ts');
const entitlement=read('lib/entitlements.ts');
const settlement=read('lib/asaas-hosted-pix-settlement.ts');

test('a produção comercial não publica cobranças com Asaas Sandbox ou webhook indisponível',()=>{
 assert.match(deploy,/Validar ambiente de cobrança antes da publicação/);
 assert.match(deploy,/if \[ "\$ASAAS_MODE" != "production" \]/);
 assert.match(deploy,/if \[ "\$ASAAS_WEBHOOK_READY" != "true" \]/);
 assert.match(deploy,/ASAAS_MODE: \$\{\{ vars\.ASAAS_MODE \}\}/);
 assert.doesNotMatch(deploy,/ASAAS_MODE: \$\{\{ vars\.ASAAS_MODE \|\| 'sandbox' \}\}/);
});
test('a auditoria espelha a configuração que realmente será publicada',()=>{
 for(const [flag,value] of Object.entries({
   EARLY_ACCESS_ENABLED:'false',
   ASAAS_BILLING_ENABLED:'true',
   ASAAS_CARD_CHECKOUT_ENABLED:'false',
   ASAAS_PRODUCTION_CARD_APPROVED:'false'
 })){
  assert.match(deploy,new RegExp(flag+": '"+value+"'"),flag);
  assert.match(audit,new RegExp(flag+": '"+value+"'"),flag);
 }
});
test('checkout oferece Pix com compra por período e exige pagamento validado',()=>{
 assert.match(pix,/chargeTypes:\['DETACHED'\]/);
 assert.match(pix,/renewal:'manual'/);
 assert.match(checkout,/if\(data\.paymentMethod==='CREDIT_CARD'&&!asaasCardCheckoutReady\(\)\)/);
 assert.match(checkout,/if\(data\.paymentMethod==='PIX'\)/);
 assert.match(settlement,/confirmed\.has\(payment\.status\)/);
 assert.match(settlement,/accepted=new Set\(\['PIX'\]\)/);
});
test('tela e políticas explicam renovação manual nos três idiomas',()=>{
 assert.match(screen,/PIX · RENOVAÇÃO MANUAL/);
 for(const key of [
  'Pagamento desta compra',
  'Preço normal deste plano',
  'Li os termos e compreendi que o Pix não tem renovação automática:',
  'Cupons valem nesta compra elegível.'
 ])assert.ok(languages.includes('"'+key)||languages.includes(key),'tradução '+key);
 assert.match(legal,/sem renovação ou débito automático/);
 assert.match(legal,/não há cobrança automática/);
 assert.match(legalLanguages,/no automatic renewal or charge/);
 assert.match(legalLanguages,/sin renovación ni cobro automático/);
});
test('assinaturas pagas só concedem benefícios após confirmação e expiram',()=>{
 assert.match(entitlement,/valid_until>now/);
 assert.match(settlement,/const eligible=payments\.filter\(p=>confirmed\.has\(p\.status\)\)/);
 assert.match(settlement,/if\(eligible\.length!==1\)/);
 assert.match(settlement,/first_paid_at/);
});
