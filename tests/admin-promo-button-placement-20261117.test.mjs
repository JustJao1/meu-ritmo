import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const panel=readFileSync('components/admin-panel.tsx','utf8');
const css=readFileSync('app/admin-theme-spacing.css','utf8');
const layout=readFileSync('app/layout.tsx','utf8');

test('botão Novo código pertence ao conteúdo da aba Códigos, fora da navegação',()=>{
 const start=panel.indexOf('<div className="admintabbar">');
 const end=panel.indexOf('</nav></div>',start);
 assert.ok(start>=0&&end>start,'barra de abas esperada');
 const tabs=panel.slice(start,end+'</nav></div>'.length);
 assert.doesNotMatch(tabs,/Novo código|admin-code-create|kind:'promo'/);
 const section=panel.indexOf('{tab===\'Códigos\'&&<><div className="adminsectionintro">');
 assert.ok(section>end,'seção deve vir depois da navegação');
 const sectionText=panel.slice(section,section+800);
 assert.match(sectionText,/className="admin-code-heading"/);
 assert.match(sectionText,/className="primary admin-code-create"/);
 assert.match(sectionText,/onClick=\{\(\)=>open\(\{kind:'promo'\}\)\}/);
 assert.equal((panel.match(/tr\("Novo código"\)/g)||[]).length,1);
});
test('o botão fica acessível e responsivo sem interferir no tema do painel',()=>{
 assert.match(css,/\.adminshell \.admin-code-heading\{/);
 assert.match(css,/justify-content:space-between/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/\.admin-code-create\{width:100%\}/);
 assert.match(css,/var\(--accent\)/);
 assert.match(layout,/import '\.\/admin-theme-spacing\.css';/);
});
