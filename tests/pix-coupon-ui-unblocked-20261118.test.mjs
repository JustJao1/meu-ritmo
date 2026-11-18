import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const checkout=read('app/ritmo.tsx');
const css=read('app/globals.css');
const localCss=read('app/billing-quote.css');
const dict=read('components/language-selector.tsx');
const status=read('app/api/billing/status/route.ts');
const quote=read('app/api/billing/quote/route.ts');
const create=read('app/api/billing/checkout/route.ts');

test('um botão indisponível não mostra cursor de carregamento eterno',()=>{
 assert.match(css,/button:disabled\{cursor:not-allowed;opacity:\.5\}/);
 assert.doesNotMatch(css,/button:disabled\{cursor:wait/);
 assert.match(localCss,/button\[aria-busy="true"\]\{cursor:progress\}/);
 assert.match(checkout,/aria-busy=\{saving\} onClick=\{\(\)=>billing\('checkout'\)\}/);
});
test('cupom inválido pode ser removido sem perder os termos aceitos',()=>{
 assert.match(checkout,/className="billing-remove-coupon"/);
 assert.match(checkout,/setDiscountCode\(''\);setPriceQuoteError\(''\)/);
 assert.match(checkout,/,\[requestedPlan,annual,paymentMethod\]\)/);
 assert.doesNotMatch(checkout,/setPurchaseRefund\(false\);\},\[requestedPlan,annual,paymentMethod,discountCode\]/);
 assert.match(localCss,/\.billing-quote-error/);
});
test('consulta do desconto e abertura de pagamento não ficam esperando indefinidamente',()=>{
 assert.match(checkout,/const controller=new AbortController\(\)/);
 assert.match(checkout,/timedOut=true;controller\.abort\(\)/);
 assert.match(checkout,/signal:controller\.signal,cache:'no-store'/);
 assert.match(checkout,/signal:controller\.signal \}\)/);
 assert.match(checkout,/clearTimeout\(limit\)/);
 assert.match(checkout,/setQuoteLoading\(false\)/);
 assert.match(checkout,/setSaving\(false\)/);
});
test('com cupom inválido o valor mínimo de Pix continua obrigatório no servidor',()=>{
 assert.match(quote,/await quoteCoupon\(price,discountCode,user\.userId\)/);
 assert.match(create,/data\.paymentMethod==='PIX'&&first<500/);
 assert.match(create,/Aceite|cupom de desconto|Ajuste o cupom/);
});
test('termos da contratação não se dividem em colunas ao alternar idioma',()=>{
 assert.match(checkout,/checked=\{purchaseTerms\}.*?\/><span>/);
 assert.match(checkout,/checked=\{purchaseRefund\}.*?\/><span>/);
 assert.match(localCss,/label\.checkline > span\{display:block;flex:1/);
 assert.match(checkout,/<LanguageSelector className="mr-language-billing"\/>/);
 for(const key of [
  'Remover cupom e continuar sem desconto',
  'A consulta demorou demais. Confira sua conexão e tente novamente.',
  'O pagamento demorou a responder. Confira sua cobrança antes de tentar outra vez.',
  'Continuar para pagamento',
  'Preencha seus dados e aceite os termos para continuar.'
 ])assert.ok(dict.includes(JSON.stringify(key)+':'),'Tradução ausente: '+key);
});
test('ações de pagamento só aparecem depois de existir cobrança',()=>{
 assert.match(checkout,/purchaseStatus\?\.hasPixToVerify&&<button/);
 assert.match(checkout,/purchaseStatus\?\.hasPaymentHistory&&<button/);
 assert.match(checkout,/purchaseStatus\?\.hasPendingPix&&<button/);
 assert.match(status,/const user=await getUser\(\)/);
 assert.match(status,/WHERE o\.user_id=\? ORDER BY o\.created_at DESC LIMIT 1/);
 assert.match(status,/result\.hasPixToVerify=/);
 assert.match(status,/result\.hasPendingPix=/);
});
