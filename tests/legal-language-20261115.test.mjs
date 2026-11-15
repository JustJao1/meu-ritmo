import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
const page=read('components/legal-page.tsx');
const translations=read('components/legal-localized-text.tsx');
const css=read('app/legal-i18n.css');

test('all four legal pages translate 62 sections plus header and footer without omitting one',()=>{
 const ids=[...page.matchAll(/<LegalText id=\{(\d+)\}>/g)].map(x=>Number(x[1]));
 const entries=[...translations.matchAll(/^\s*(\d+):\[/gm)].map(x=>Number(x[1]));
 assert.equal(entries.length,74);
 assert.equal(new Set(entries).size,74);
 for(let i=1;i<=74;i++)assert.ok(entries.includes(i),'missing legal translation '+i);
 for(let i=1;i<=74;i++)if(i<63||i>66)assert.ok(ids.includes(i),'missing legal text '+i);
 assert.match(page,/id=\{kind==='privacy'\?63:kind==='terms'\?64:kind==='refund'\?65:66\}/);
 assert.match(page,/kind==='refund'/);
 assert.match(page,/kind==='privacy'/);
 assert.match(page,/kind==='terms'/);
 assert.match(page,/Regras da comunidade/);
});

test('legal language selector is present and responds to the same language preference as the app',()=>{
 assert.match(page,/import LanguageSelector from '\.\/language-selector';/);
 assert.match(page,/<LanguageSelector className="mr-language-legal"\/>/);
 assert.match(translations,/const \{locale\}=useLocale\(\)/);
 assert.match(translations,/locale==='en'/);
 assert.match(translations,/locale==='es'/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(read('app/layout.tsx'),/import '\.\/legal-i18n\.css';/);
});

test('legal account closure accurately describes deletion of the Supabase login',()=>{
 const privacyRoute=read('app/api/privacy/route.ts');
 assert.match(privacyRoute,/auth\/v1\/admin\/users/);
 assert.match(page,/No encerramento completo, o login do Supabase também é excluído/);
 assert.doesNotMatch(page,/A conta Supabase é independente e não é excluída/);
 assert.match(translations,/Full account closure also deletes the Supabase login/);
});

test('Portuguese remains the canonical fallback if a translation is unavailable',()=>{
 assert.match(translations,/pair\?\.\[0\]\|\|children/);
 assert.match(translations,/pair\?\.\[1\]\|\|children/);
});
