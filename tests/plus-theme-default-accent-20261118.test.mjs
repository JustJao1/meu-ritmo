import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync('lib/plans.ts','utf8');
const studio=readFileSync('components/premium-studio.tsx','utf8');
const server=readFileSync('app/api/state/route.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{}};
vm.runInNewContext(compiled,context);
const {themes,freeThemeIds,proExclusiveThemes,accentPalette,defaultAppearance,isProExclusiveTheme,isPlusAccentAllowed,effectiveAppearance,paidChangeError}=context.exports;
const blank=(appearance)=>({items:[],appearance:{...defaultAppearance,...appearance}});

test('todos os nove temas Plus mantêm a cor oficial sem solicitar o Pro',()=>{
 const plusThemes=themes.filter(t=>!freeThemeIds.includes(t.id)&&!proExclusiveThemes.includes(t.id));
 assert.equal(plusThemes.length,9);
 for(const theme of plusThemes){
  assert.equal(isProExclusiveTheme(theme.id),false,theme.id);
  assert.equal(isPlusAccentAllowed(theme.id,theme.accent),true,theme.id);
  const next=blank({theme:theme.id,accent:theme.accent});
  assert.equal(paidChangeError(next,blank({}), 'plus'),null,theme.id);
  const shown=effectiveAppearance(next,'plus');
  assert.equal(shown.theme,theme.id,theme.id);
  assert.equal(shown.accent,theme.accent,theme.id);
 }
});

test('Plus mantém paleta liberada e recusa cores arbitrárias',()=>{
 const theme=themes.find(t=>t.id==='sand');
 assert(theme);
 for(const color of accentPalette){
  const next=blank({theme:theme.id,accent:color});
  assert.equal(isPlusAccentAllowed(theme.id,color),true);
  assert.equal(paidChangeError(next,blank({}),'plus'),null,color);
 }
 const custom=blank({theme:theme.id,accent:'#123456'});
 assert.equal(isPlusAccentAllowed(theme.id,custom.appearance.accent),false);
 assert.match(paidChangeError(custom,blank({}),'plus'),/Pro/);
 const restored=effectiveAppearance(custom,'plus');
 assert.equal(restored.accent,theme.accent);
 assert.equal(effectiveAppearance(custom,'pro').accent,'#123456');
});

test('temas Pro seguem exclusivos e temas Plus seguem bloqueados no gratuito',()=>{
 for(const t of themes.filter(t=>proExclusiveThemes.includes(t.id))){
  const next=blank({theme:t.id,accent:t.accent});
  assert.match(paidChangeError(next,blank({}),'plus'),/exclusivo do plano Pro/,t.id);
 }
 const sand=themes.find(t=>t.id==='sand');
 assert.match(paidChangeError(blank({theme:sand.id,accent:sand.accent}),blank({}),'free'),/Plus/);
});

test('a tela, a aplicação e a API usam a mesma regra de acesso',()=>{
 assert(studio.includes('isPlusAccentAllowed(draft.theme,draft.accent)'));
 assert(studio.includes("tier==='pro'&&!pro?"));
 assert(studio.includes("tier==='plus'&&!paid?"));
 assert(source.includes('isPlusAccentAllowed(a.theme,a.accent)'));
 assert(server.includes('paidChangeError(data,'));
});
