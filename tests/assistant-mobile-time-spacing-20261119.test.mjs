import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync('app/assistant-feedback.css','utf8');
const form=readFileSync('components/smart-assistant.tsx','utf8');

test('horarios do assistente ficam empilhados e com espacamento confortavel em celulares estreitos',()=>{
 assert.match(css,/@media\(max-width:520px\)\{\s*\.smart-assistant \.assistant-setting-details > \.assistant-availability\{\s*grid-template-columns:minmax\(0,1fr\);/);
 assert.match(css,/row-gap:17px/);
 assert.match(css,/\.assistant-setting-details > \.assistant-availability input\{[\s\S]*?min-width:0;[\s\S]*?min-height:48px;/);
 assert.match(css,/\.assistant-setting-details > \.assistant-availability label:last-child\{\s*grid-column:auto;/);
});

test('ajuste apenas visual preserva tres campos e seus dados para a proposta',()=>{
 assert.match(form,/className="assistant-availability"/);
 assert.match(form,/type="time" value=\{start\}/);
 assert.match(form,/type="time" value=\{end\}/);
 assert.match(form,/type="number" min=\{5\} max=\{240\}/);
});
