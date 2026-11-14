import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const locale=src('components/language-selector.tsx');
const dict=locale.match(/const translations:Record<string,\[string,string\]>=\{([\s\S]*?)\n\};/);
const keys=new Set([...dict[1].matchAll(/"((?:\\.|[^"\\])*)":\[/g)].map(m=>JSON.parse('"'+m[1]+'"')));
for(const m of dict[1].matchAll(/'([^']+)':\[/g))keys.add(m[1]);

test('UI locale references in major modules all have English and Spanish translations',()=>{
 for(const file of [
  'app/ritmo.tsx','components/community.tsx','components/admin-panel.tsx',
  'components/admin-extras.tsx','components/premium-studio.tsx',
  'components/alert-center.tsx','components/auth-form.tsx',
  'components/profile-editor.tsx','components/plan-comparison.tsx'
 ]){
  const contents=src(file);
  const used=[...contents.matchAll(/\b(?:t|tr|translateTab)\((['"])(.*?)\1\)/g)].map(m=>m[2]);
  for(const key of used)assert.ok(keys.has(key),file+' is missing '+JSON.stringify(key));
 }
});
test('Locale changes update document and persist across visits',()=>{
 assert.match(locale,/localStorage\.setItem\('mr-language'/);
 assert.match(locale,/document\.documentElement\.lang=/);
 assert.match(locale,/mr-language-change/);
 for(const language of ['pt-BR','en','es'])assert.ok(locale.includes(language));
});
test('Main app translates state labels without changing stored IDs or dates',()=>{
 const main=src('app/ritmo.tsx');
 assert.match(main,/const \{t,locale\}=useLocale\(\)/);
 assert.match(main,/toLocaleDateString\(locale/);
 assert.match(main,/value=\{v\}>\{t\(v\)\}<\/option>/);
 assert.match(main,/\{t\(labels\[k\]\)\}/);
 const community=src('components/community.tsx');
 assert.match(community,/\{tr\(n\)\}<\/button>/);
 assert.match(community,/tr\("Compartilhar com a comunidade"\)/);
 const admin=src('components/admin-panel.tsx');
 assert.match(admin,/\{tr\(t\.name\)\}<\/button>/);
 assert.match(admin,/tr\("Contas bem cuidadas\."\)/);
});
test('Selected day preserves contrast for light and dark themes',()=>{
 const css=src('app/theme-contrast-audit.css');
 assert.match(css,/calendarcolumns header\.istoday/);
 assert.match(css,/background:var\(--theme-raised/);
 assert.match(css,/color:var\(--ink\)!important/);
});
