import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../app/finance-income.css',import.meta.url),'utf8');
const ui=readFileSync(new URL('../app/ritmo.tsx',import.meta.url),'utf8');

test('as barras das despesas não reutilizam o destaque verde dos ganhos',()=>{
 assert.match(css,/--expense-chart-tone:color-mix/);
 assert.match(css,/\.appframe \.financesummary \.categorybar \.progress > i/);
 assert.match(css,/\.appframe \.financecontent\.budget-within \.progress > i/);
 assert.match(css,/background:var\(--expense-chart-tone\)/);
 assert.match(ui,/className="categorybar"/);
 assert.match(ui,/financecontent budget-/);
});

test('despesas respeitam temas claros e escuros, preservando os alertas de orçamento',()=>{
 for(const theme of ['midnight','forest','obsidian','blackout','eclipse'])assert.ok(css.includes('[data-theme="'+theme+'"]'));
 assert.match(css,/\.appframe \.financecontent\.budget-over \.progress > i\{background:#bc4d3d\}/);
 assert.match(css,/\.appframe \.financecontent\.budget-reviewed \.progress > i\{background:#bd9342\}/);
 assert.match(css,/--income-tone:/);
 assert.match(css,/\.finance-add-actions \.income-add/);
});
