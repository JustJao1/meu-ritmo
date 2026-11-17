import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('assistente usa dois painéis acessíveis com rótulos e indicadores de expansão',()=>{
 const app=source('components/smart-assistant.tsx');
 assert.match(app,/details className="assistant-setting-details"/);
 assert.match(app,/details className="assistant-examples"/);
 assert.match(app,/assistant-disclosure-chevron/);
 assert.match(app,/Horários disponíveis/);
 assert.ok(app.includes('O que posso pedir?'));
});
test('painéis respeitam o tema, toque no celular e foco por teclado',()=>{
 const css=source('app/assistant-feedback.css');
 assert.match(css,/min-height:58px/);
 assert.ok(css.includes('background:var(--paper)'));
 assert.ok(css.includes('color:var(--ink)'));
 assert.match(css,/:focus-visible/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/grid-template-columns:1fr/);
});
