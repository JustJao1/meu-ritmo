import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const global=read('app/globals.css');
const css=read('app/studio-action-theme.css');
const layout=read('app/layout.tsx');
const studio=read('components/premium-studio.tsx');

test('restaurar prévia não tem cor verde fixa nem fonte minúscula',()=>{
 assert.doesNotMatch(global,/\.studioactions>button:first-child\{[^}]*color:#6b775e/);
 assert.doesNotMatch(global,/\.studioactions>button:first-child\{[^}]*font-size:10px/);
 assert.match(studio,/Restaurar prévia original/);
 assert.match(css,/\.studioactions>button:first-child\{/);
 assert.match(css,/color:var\(--ink\)/);
 assert.match(css,/background:var\(--paper\)/);
 assert.match(css,/border:1px solid var\(--theme-divider/);
 assert.match(css,/min-height:44px/);
});
test('estados hover, foco, clique e celular respeitam o tema',()=>{
 assert.match(css,/:hover\{/);
 assert.match(css,/:focus-visible\{/);
 assert.match(css,/:active\{/);
 assert.match(css,/@media\(max-width:540px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(css,/#[0-9a-fA-F]{3,8}\b/);
 const importOld=layout.indexOf("import './comfort-polish.css';");
 const importNew=layout.indexOf("import './studio-action-theme.css';");
 assert(importNew>importOld);
});
