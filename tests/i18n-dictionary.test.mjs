import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../components/language-selector.tsx',import.meta.url),'utf8');
const dictionary=source.match(/const translations:Record<string,\[string,string\]>=\{([\s\S]*?)\n\};/);
test('i18n: dicionário presente e sem chaves duplicadas',()=>{
 assert.ok(dictionary,'Dicionário não encontrado');
 const keys=[...dictionary[1].matchAll(/(?:^|[,\n])\s*(['"])(.*?)\1\s*:\s*\[/g)].map(x=>x[2]);
 assert.ok(keys.length>0,'Dicionário vazio');
 assert.equal(new Set(keys).size,keys.length,'Há chaves de tradução duplicadas');
});
test('i18n: nenhuma tradução vazia nos idiomas existentes',()=>{
 assert.ok(dictionary);
 const entries=[...dictionary[1].matchAll(/(?:^|[,\n])\s*(['"])(.*?)\1\s*:\s*\[\s*(['"])(.*?)\3\s*,\s*(['"])(.*?)\5\s*\]/g)];
 assert.ok(entries.length>0,'Não foi possível analisar traduções');
 for(const e of entries){assert.ok(e[4].trim(),'Tradução inglesa vazia: '+e[2]);assert.ok(e[6].trim(),'Tradução espanhola vazia: '+e[2]);}
});
