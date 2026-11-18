import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
const plans=read('lib/plans.ts');
const schema=read('lib/state-validation.ts');
const studio=read('components/premium-studio.tsx');
const app=read('app/ritmo.tsx');
const style=read('app/comfort-polish.css');
const layout=read('app/layout.tsx');
const dictionary=read('components/language-selector.tsx');

test('seis famílias disponíveis no perfil e aceitas pelo servidor',()=>{
 for(const id of ['sans','humanist','modern','editorial','classic','reading']){
  assert(plans.includes("id:'"+id+"'"),'font missing: '+id);
  assert(schema.includes("'"+id+"'"),'validation missing: '+id);
 }
 assert.match(plans,/export type TitleStyle=/);
 assert.match(studio,/titleFonts\.map\(font=>/);
 assert.match(studio,/aria-pressed=\{draft\.titleStyle===font\.id\}/);
 assert.match(studio,/font-sample/);
 assert.match(style,/html\[data-title-style="classic"\]/);
 assert.match(style,/font-family:var\(--font-headings\)!important/);
 assert.match(style,/\.studio-custom-title/);
});

test('pagamento abre outra aba ao clicar, sem perder a sessão atual',()=>{
 const open=app.indexOf("const checkoutTab=window.open('about:blank','_blank')");
 const fetchOrder=app.indexOf("await fetch('/api/billing/' + action");
 assert(open>0&&fetchOrder>open,'reserve the new tab before await');
 assert.match(app,/checkoutTab\.opener=null/);
 assert.match(app,/checkoutTab\.location\.replace\(url\.href\)/);
 assert.match(app,/setPaymentOpenUrl\(url\.href\)/);
 assert.match(app,/target="_blank" rel="noopener noreferrer" href=\{paymentOpenUrl\}/);
 assert.doesNotMatch(app,/location\.href=url\.href/);
 assert.match(app,/if\(!asaasHosted&&/);
 assert.match(app,/mr_pix_hosted_pending/);
});

test('contratação apresenta seções e mantém confirmação pelo Asaas',()=>{
 for(const cls of ['billing-payer','billing-method-section','billing-summary-section','billing-safe-note']){
  assert(app.includes(cls),cls);
 }
 for(const key of ['Dados para pagamento','Forma de pagamento e desconto','Confira sua assinatura','O pagamento abre em outra aba e seu espaço continua disponível aqui.']){
  assert(dictionary.includes(JSON.stringify(key)+':['),key+' not localized');
 }
 assert.match(style,/\.billing-method-choice\{\s*display:grid;grid-template-columns:1fr/);
 assert.match(style,/@media\(max-width:650px\)/);
 assert.match(layout,/import '\.\/comfort-polish\.css'/);
});

test('revisão cobre landing, perfil, app, entrada, administração e documentos',()=>{
 for(const selector of ['.landing .features','.premiumstudio .font-gallery','.appframe .daybanner','.authpage .authsheet','.adminshell .adminmain','.legalpage p']){
  assert(style.includes(selector),selector);
 }
 assert.match(style,/var\(--paper\)/);
 assert.match(style,/var\(--ink\)/);
 assert.match(style,/prefers-reduced-motion:reduce/);
});
