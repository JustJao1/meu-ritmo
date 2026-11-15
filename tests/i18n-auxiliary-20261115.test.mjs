import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const dictionary=read('components/language-selector.tsx');
const match=dictionary.match(/const translations:Record<string,\[string,string\]>=\{([\s\S]*?)\n\};/);
const keys=new Set([...match[1].matchAll(/"((?:\\.|[^"\\])*)":\[/g)].map(m=>JSON.parse('"'+m[1]+'"')));
for(const m of match[1].matchAll(/'([^']+)':\[/g))keys.add(m[1]);

test('all static translation requests from auxiliary UI have both language mappings',()=>{
 for(const path of [
  'components/privacy-center.tsx','components/cookie-consent.tsx',
  'components/registration.tsx','components/weather-widget.tsx','app/error.tsx',
  'components/admin-panel.tsx'
 ]){
  const src=read(path);
  for(const m of src.matchAll(/\b(?:t|tr)\((['"])(.*?)\1\)/g))
   assert.ok(keys.has(m[2]),path+' is missing '+JSON.stringify(m[2]));
 }
});

test('data export, privacy and account deletion remain available and translated',()=>{
 const src=read('components/privacy-center.tsx');
 assert.match(src,/useLocale\(\)/);
 assert.match(src,/t\("Exportar meus dados"\)/);
 assert.match(src,/t\("Reembolso ou arrependimento de compra"\)/);
 assert.match(src,/t\("Também encerrar minha conta no Meu Ritmo"\)/);
 assert.match(src,/toLocaleDateString\(locale\)/);
 assert.match(src,/kind==='deletion'/);
 assert.match(src,/confirmDelete!=='EXCLUIR MEUS DADOS'/);
});

test('cookie preferences remain separate, translated and accessible',()=>{
 const src=read('components/cookie-consent.tsx');
 assert.match(src,/const \{t\}=useLocale\(\)/);
 assert.match(src,/t\("Salvar escolhas"\)/);
 assert.match(src,/choose\(preferences,analytics\)/);
 assert.match(src,/Desenvolvido por/);
 assert.match(src,/João Victor da Silva/);
});

test('registration, errors and weather follow the user selected locale',()=>{
 assert.match(read('components/registration.tsx'),/t\('Como você quer aparecer\?'\)/);
 assert.match(read('app/error.tsx'),/t\('Não foi possível abrir esta área\.'\)/);
 const weather=read('components/weather-widget.tsx');
 assert.match(weather,/const \{t,locale\}=useLocale\(\)/);
 assert.match(weather,/toLocaleDateString\(locale/);
 assert.match(weather,/t\(desc\(forecast\.current\.weather_code\)\)/);
 assert.match(weather,/language='\+lang/);
 assert.match(read('app/api/weather/route.ts'),/requestedLanguage==='en'\|\|requestedLanguage==='es'/);
});
