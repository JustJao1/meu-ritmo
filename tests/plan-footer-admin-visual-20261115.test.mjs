import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
const css=read('app/plan-footer-admin-contrast.css');
const prices=read('components/plan-comparison.tsx');
const admin=read('components/admin-billing.tsx');
const app=read('app/ritmo.tsx');
const translations=read('components/language-selector.tsx');

test('pricing buttons take a contrasting foreground/background from the active theme',()=>{
  assert.match(css,/\.plancomparison \.plancard \.plan-select\s*\{/);
  assert.match(css,/background:var\(--ink\);\s*border:1px solid var\(--ink\);\s*color:var\(--paper\)/);
  assert.match(css,/\.plan-select svg\{\s*color:inherit/);
  assert.match(css,/\.plan-select:hover\{[\s\S]*?color:var\(--paper\)/);
  assert.match(prices,/className=\{'plan-select '\+/);
});

test('pricing cards use the selected theme and avoid huge empty rows',()=>{
  assert.match(css,/\.plancomparison \.plans\{[\s\S]*?align-items:start/);
  assert.match(css,/\.plancomparison \.plancard\.featured\{[\s\S]*?background:color-mix\(in srgb,var\(--paper\) 90%,var\(--accent\) 10%\)/);
  assert.match(css,/\.plancomparison \.plancard \.plantry\{[\s\S]*?margin:25px 0 0/);
  assert.match(prices,/data-plan=\{id\}/);
  assert.match(css,/\.plancomparison \.plancard \.currentplan\{/);
  assert.match(css,/\.plancomparison \.planprinciples strong\{/);
});

test('both app branding and permanent legal footer have legible theme-based styles',()=>{
  assert.match(app,/<span className="appfooter-brand">Meu Ritmo/);
  assert.doesNotMatch(app,/<span>meu ritmo <span className="coraltext">/);
  assert.match(css,/:root \.appframe \.appfooter>span\.appfooter-brand\{/);
  assert.match(css,/\.sitelegalfooter nav :is\(a,button\)\{/);
  assert.match(css,/font-size:12px/);
  assert.match(css,/color:color-mix\(in srgb,var\(--ink\) 82%,var\(--paper\)\)/);
});

test('admin metrics have capitalized labels, readable text and appropriate translation',()=>{
  const names=['Pedidos registrados','Ativos','Aguardando pagamento','Em conferência','Cancelados'];
  for(const name of names)assert.ok(admin.includes("label:'"+name+"'"),'Missing exact label '+name);
  assert.match(admin,/<span>\{t\(m\.label\)\}<\/span>/);
  for(const name of ['Pedidos registrados','Ativos','Em conferência','Cancelados'])
    assert.ok(translations.includes(JSON.stringify(name)+':'),name+' not translated');
  assert.match(css,/\.adminbilling \.billing-metric span\{[\s\S]*?font-size:14px/);
  assert.match(css,/\.adminbilling \.billing-metric strong\{[\s\S]*?font-size:30px/);
});

test('the theme and spacing fixes are loaded last and have responsive rules',()=>{
  const layout=read('app/layout.tsx');
  assert.match(layout,/import '\.\/plan-footer-admin-contrast\.css'/);
  assert.ok(layout.indexOf("import './plan-footer-admin-contrast.css'")>layout.indexOf("import './routine-social.css'"));
  for(const width of [1180,900,670,390])assert.ok(css.includes('@media(max-width:'+width+'px)'),width+'px missing');
  assert.match(css,/focus-visible/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
