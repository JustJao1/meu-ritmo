import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const app=read('app/ritmo.tsx');
const pricing=read('components/plan-comparison.tsx');
const studio=read('components/premium-studio.tsx');
const locale=read('components/language-selector.tsx');
const css=read('app/theme-contrast-audit.css');
const adminCss=read('app/plan-footer-admin-contrast.css');
const discounts=read('components/admin-extras.tsx');
const checkout=read('app/api/billing/checkout/route.ts');

test('modal de benefícios oferece contratação Pix em vez de acesso gratuito sem pagamento',()=>{
 assert.match(app,/onClick=\{\(\)=>beginPurchase\(requestedPlan\)\}/);
 assert.match(app,/setPanel\('Assinatura'\)/);
 assert.match(app,/accountAccess\?\.source==='subscription'/);
 assert.match(app,/Usar meus recursos/);
 assert.doesNotMatch(app,/Durante o acesso antecipado, todos esses recursos estão disponíveis gratuitamente na sua conta/);
 assert.match(app,/A contratação é feita por Pix e vale pelo período escolhido/);
 assert.match(app,/O assistente inteligente é exclusivo do Pro/);
 assert.match(checkout,/hostedPixCheckoutPayload/);
 assert.match(checkout,/if\(data\.paymentMethod==='CREDIT_CARD'&&!asaasCardCheckoutReady\(\)\)/);
});
test('demonstração e página pública conservam intenção da compra ao abrir a conta',()=>{
 assert.match(app,/sessionStorage\.setItem\('mr_purchase_intent'/);
 assert.match(app,/sessionStorage\.getItem\('mr_purchase_intent'\)/);
 assert.match(app,/location\.href='\/app'/);
 assert.match(app,/setAnnual\(intent\.endsWith\('_year'\)\)/);
 assert.match(app,/earlyAccess=\{purchaseStatus\?\.earlyAccess===true\}/);
});
test('grade de planos traduz todas as características ao mudar o idioma',()=>{
 assert.match(pricing,/const benefits:Record<Plan,string\[\]>/);
 assert.match(pricing,/benefits\[id\]\.map\(f=><li key=\{f\}>/);
 assert.match(pricing,/\{tr\(f\)\}/);
 assert.match(pricing,/\{tr\(descriptions\[id\]\)\}/);
 assert.match(pricing,/showCurrent&&current===id/);
 assert.match(app,/showCurrent=\{!publicPage&&!demo\}/);
 for(const k of [
 'Para usar todos os dias.','Tudo do Gratuito','Publicação de rotinas personalizadas no Social',
 '20 notas fixadas e 12 modelos prontos de rotina',
 'Ver benefícios do plano','Explorar na demonstração','Contratar Plus','Contratar Pro'
 ])assert.ok(locale.includes(JSON.stringify(k)+':'),k);
});
test('área Meu Ritmo App usa dicionário e nota respeita paleta em prévia de tema',()=>{
 assert.match(studio,/translateTab\('Aplicativo Meu Ritmo'\)/);
 assert.match(studio,/translateTab\(tab==='Aparência'\?/);
 assert.match(studio,/backgroundColor:theme\.banner,color:theme\.ink/);
 assert.match(css,/\.mocknote :is\(h4,p,span,svg\)\{\s*color:inherit/);
 assert.doesNotMatch(css,/#5d522c/);
 for(const k of ['Aplicativo Meu Ritmo','Gerar chave para o app','Um jeito diferente de ver o dia.'])
  assert.ok(locale.includes(JSON.stringify(k)+':'),k);
});
test('cupons de desconto são legíveis em todos os temas e seus estados são traduzidos',()=>{
 assert.match(adminCss,/\.adminshell \.adminextras \.promolist article > :is\(p,small\)/);
 assert.match(adminCss,/color:color-mix\(in srgb,var\(--ink\)/);
 assert.match(discounts,/tr\(d\.enabled\?'Ativo · uso condicionado à disponibilidade do pagamento':'Desativado'\)/);
 assert.match(discounts,/toLocaleDateString\(locale\)/);
});
