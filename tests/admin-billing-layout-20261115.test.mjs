import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(p,'utf8');
const component=read('components/admin-billing.tsx');
const css=read('app/admin-billing-layout.css');
const layout=read('app/layout.tsx');
const panel=read('components/admin-panel.tsx');
const locales=read('components/language-selector.tsx');

test('billing controls use dedicated spaced filter and action groups',()=>{
  assert.match(component,/className="billing-toolbar"/);
  assert.match(component,/className="billing-filter"/);
  assert.match(component,/className="billing-actions"/);
  assert.match(component,/htmlFor="billing-status-filter"/);
  assert.match(component,/id="billing-status-filter"/);
  assert.match(css,/\.adminshell \.adminbilling \.billing-toolbar/);
  assert.match(css,/gap:18px 24px/);
  assert.match(css,/min-height:48px/);
});
test('empty billing state is spacious and provides a way to clear selected filters',()=>{
  assert.match(component,/className="billing-empty"/);
  assert.match(component,/Nenhuma cobrança registrada ainda\./);
  assert.match(component,/onClick=\{\(\)=>setFilter\('all'\)\}/);
  assert.match(css,/min-height:255px/);
  assert.match(css,/\.adminshell \.adminbilling \.billing-footnote/);
  assert.match(component,/aria-live="polite"/);
});
test('responsive billing styles use existing theme tokens and do not modify other admin tabs',()=>{
  assert.match(layout,/import '\.\/admin-billing-layout\.css';/);
  assert.match(css,/var\(--admin-surface/);
  assert.match(css,/@media\(max-width:1120px\)/);
  assert.match(css,/@media\(max-width:740px\)/);
  assert.match(css,/@media\(max-width:400px\)/);
  assert.match(panel,/!\['Cobranças','Opiniões','Atendimento'\]\.includes\(tab\)&&<form className="adminsearch"/);
  assert.match(panel,/tab==='Cobranças'&&<AdminBilling/);
});
test('new billing messages are translated in Portuguese, English and Spanish',()=>{
  for(const key of ['Resumo das cobranças','Atualizando…','Nenhuma cobrança registrada ainda.','Ver todas as cobranças'])
    assert.ok(locales.includes(JSON.stringify(key)+':'),key);
});
