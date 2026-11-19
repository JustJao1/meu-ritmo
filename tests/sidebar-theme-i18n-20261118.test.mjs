import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync('app/ritmo.tsx','utf8');
const css=readFileSync('app/sidebar-shared-polish.css','utf8');
const translations=readFileSync('components/language-selector.tsx','utf8');
const layout=readFileSync('app/layout.tsx','utf8');

test('barra lateral usa a própria paleta em todos os temas, inclusive ativo e hover',()=>{
 const nav=css.slice(0,css.indexOf('.appframe .bottomnav'));
 assert.match(nav,/var\(--theme-banner/);
 assert.match(nav,/var\(--theme-side/);
 assert.match(nav,/\.sidebar nav>button\.active/);
 assert.match(nav,/\.sidebar nav>button\.active::before/);
 assert.match(nav,/content:none;/);
 assert.match(nav,/display:none;/);
 assert.match(nav,/width:100%;/);
 assert.match(nav,/box-sizing:border-box;/);
 assert.match(nav,/border:1px solid transparent;/);
 assert.doesNotMatch(nav,/var\(--accent\)/);
 assert.match(layout,/import '\.\/sidebar-shared-polish\.css'/);
});

test('link do aplicativo aparece localizado na lateral e no topo',()=>{
 assert.equal((app.match(/t\("Aplicativo Meu Ritmo"\)/g)||[]).length,2);
 assert.match(app,/aria-label=\{t\("Abrir aplicativo Meu Ritmo"\)\}/);
 assert.match(translations,/"Aplicativo Meu Ritmo":\["Meu Ritmo App","Aplicación Meu Ritmo"\]/);
 assert.match(translations,/"Abrir aplicativo Meu Ritmo":\["Open Meu Ritmo app","Abrir la aplicación Meu Ritmo"\]/);
 assert(!app.includes('>{t("Meu Ritmo App")}'));
});

test('ícones e nomes não mudam de posição quando o item Agenda é selecionado',()=>{
 const base=css.slice(css.indexOf('.appframe .sidebar nav>button{'),css.indexOf('.appframe .sidebar nav>button:hover'));
 assert.match(base,/padding:8px 12px;/);
 assert.match(base,/gap:12px;/);
 assert.match(base,/min-height:50px;/);
 const active=css.slice(css.indexOf('.appframe .sidebar nav>button.active{'),css.indexOf('.appframe .sidebar nav>button:focus-visible'));
 assert.doesNotMatch(active,/padding|gap|margin|transform/);
 assert.match(css,/\.sidebar nav>button.active::before\{\s*content:none;\s*display:none;/);
});

test('ícone de Agenda mantém o mesmo desenho, borda e fundo entre estados normal e ativo',()=>{
 const base=css.match(/\.appframe \.sidebar nav>button>\.mr-nav-icon\{([\s\S]*?)\}/)?.[1];
 const selected=css.match(/\.appframe \.sidebar nav>button:is\(:hover,\.active\)>\.mr-nav-icon\{([\s\S]*?)\}/)?.[1];
 assert(base&&selected);
 const style=(body,key)=>body.match(new RegExp(key+':([^;]+);'))?.[1]?.trim();
 for(const key of ['background','border-color']) {
  const normal=key==='border-color'?style(base,'border').replace(/^1px solid /,''):style(base,key);
  assert.equal(style(selected,key),normal,key);
 }
 const assistantStyles=readFileSync('app/assistant-feedback.css','utf8');
 assert.doesNotMatch(assistantStyles,/\.sidebar nav>button\.active \.category-illustration rect\s*\{\s*opacity:\s*\.19/);
 assert.match(css,/\.sidebar nav>button:is\(:hover,\.active\) \.category-illustration rect\{\s*opacity:1;/);
 assert.match(app,/<CategoryIllustration name=\{n\.name\} size=\{21\}\/>/);
});
