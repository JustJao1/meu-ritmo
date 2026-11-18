import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const admin=readFileSync('components/admin-panel.tsx','utf8');
const style=readFileSync('app/admin-theme-spacing.css','utf8');
const logo=readFileSync('public/favicon-mr-v3.svg','utf8');
const app=readFileSync('app/ritmo.tsx','utf8');

test('cabeçalho administrativo exibe a marca oficial sem monograma legado',()=>{
 assert.match(admin,/<a className="brand adminbrand-link" href="\/app"><img className="adminbrand-logo" src="\/favicon-mr-v3\.svg"/);
 assert.doesNotMatch(admin,/<a className="brand" href="\/app"><img className="brandmark brandmark-icon"/);
 assert.match(app,/src="\/favicon-mr-v3\.svg"/);
 assert.match(logo,/viewBox="0 0 96 96"/);
});
test('imagem no admin fica proporcional, sem fundo, borda nem sombra',()=>{
 assert.match(style,/\.adminshell > \.adminnav \.adminbrand-logo\{/);
 assert.match(style,/width:36px!important;height:36px!important/);
 assert.match(style,/object-fit:contain!important/);
 assert.match(style,/border:0!important;border-radius:0!important/);
 assert.match(style,/background:transparent!important/);
 assert.match(style,/box-shadow:none!important;filter:none!important/);
 assert.match(style,/transform:none!important;opacity:1!important/);
 assert.doesNotMatch(style,/\.adminshell > \.adminnav \.brandmark\{\s*background:var\(--admin-surface\)!important/);
});
test('logo do admin conserva leitura e tamanho em telas pequenas',()=>{
 assert.match(style,/@media\(max-width:520px\)/);
 assert.match(style,/width:32px!important;height:32px!important;max-width:32px!important/);
 assert.match(style,/font-size:clamp\(16px,1\.6vw,20px\)/);
 assert.match(style,/font-family:Manrope,'DM Sans',sans-serif/);
});
