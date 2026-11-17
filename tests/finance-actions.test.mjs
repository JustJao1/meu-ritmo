import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../app/ritmo.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/finance-income.css',import.meta.url),'utf8');

test('a tela financeira usa apenas o par de ações do filtro',()=>{
  assert.match(ui,/area !== 'Gastos' && <button className="primary"/);
  assert.doesNotMatch(ui,/t\("Novo gasto"\)/);
  assert.equal((ui.match(/onClick=\{\(\) => open\('expense'\)\}/g)||[]).length,1);
  assert.equal((ui.match(/onClick=\{\(\) => open\('income'\)\}/g)||[]).length,1);
  assert.match(ui,/className="finance-add-actions"/);
  assert.doesNotMatch(ui,/className="finance-empty-actions"/);
});

test('registrar ganho recebe indicação positiva com ajuste ao tema, hover e foco',()=>{
  assert.match(ui,/className="income-add"/);
  assert.match(css,/--income-tone:color-mix/);
  assert.match(css,/--income-text:color-mix/);
  assert.match(css,/\.finance-add-actions \.income-add:hover/);
  assert.match(css,/\.finance-add-actions \.income-add:focus-visible/);
  assert.match(css,/data-theme="midnight"/);
  assert.match(css,/data-theme="forest"/);
});
