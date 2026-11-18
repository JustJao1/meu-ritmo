import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync('scripts/asaas-production-customer-checkout-diagnostic.mjs','utf8');
const wf=readFileSync('.github/workflows/asaas-production-customer-checkout-diagnostic.yml','utf8');

test('diagnóstico usa somente a produção e nunca expõe dados de clientes em logs',()=>{
 assert.match(src,/ASAAS_MODE!=='production'/);
 assert.match(src,/\$aact_prod_/);
 assert.match(src,/console\.log\('Etapa 1:/);
 assert.doesNotMatch(src,/console\.log\([^\n]*(?:order\.id|order\.customer_id|cust\.data)/);
 assert.match(wf,/environment: production/);
 assert.match(wf,/ASAAS_API_KEY: \$\{\{ secrets\.ASAAS_API_KEY \}\}/);
});
test('cria um único checkout Pix técnico sem cartão e cancela antes de liberar pedido',()=>{
 assert.match(src,/billingTypes:\['PIX'\],chargeTypes:\['DETACHED'\]/);
 assert.match(src,/value:5\.00/);
 assert.match(src,/checkoutId\+'\/cancel'/);
 assert.match(src,/if\(!cancelOk\)throw Error/);
 assert.ok(src.indexOf("if(!cancelOk)throw Error")<src.indexOf("UPDATE asaas_orders SET status='cancelled'"));
});
test('não libera o cupom se houver pagamento, assinatura ou checkout local',()=>{
 assert.match(src,/payments\.data\.data\.length\|\|subs\.data\.data\.length/);
 assert.match(src,/NOT EXISTS\(SELECT 1 FROM asaas_hosted_pix_checkouts/);
 assert.match(src,/NOT EXISTS\(SELECT 1 FROM asaas_card_checkouts/);
 assert.match(src,/first_paid_at IS NULL/);
 assert.match(src,/provider_subscription_id IS NULL/);
 assert.match(src,/status='cancelled' AND first_paid_at IS NULL/);
});
