import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync('app/ritmo.tsx','utf8');
const api=readFileSync('app/api/billing/checkout/route.ts','utf8');
const locale=readFileSync('components/language-selector.tsx','utf8');

test('formulário transmite os dados de contato e endereço exigidos pelo checkout',()=>{
 for(const [field,state] of [['phone','billingPhone'],['postalCode','billingPostalCode'],['address','billingStreet'],['addressNumber','billingNumber'],['province','billingDistrict']]){
  assert.match(app,new RegExp(field+':'+state+'(?:,|})'));
  assert.match(api,new RegExp(field+':z\\.string'));
 }
 assert.match(app,/billingPostalCode\.replace\(\/\\D\/g,''\)\.length!==8/);
 assert.match(app,/billingPhone\.replace\(\/\\D\/g,''\)\.length<10/);
 assert.match(app,/disabled=\{saving\|\|quoteLoading/);
});
test('dados comerciais não são armazenados no navegador ou escritos em logs',()=>{
 assert.match(api,/stage='customer_update'/);
 assert.match(api,/method:'PUT',body:customerDetails/);
 assert.match(api,/stage,httpStatus,release:safeToRelease,provider:'asaas'/);
 assert.doesNotMatch(app,/localStorage\.setItem\(['"]billing(Phone|Street|PostalCode)/);
});
test('campos do pagador possuem tradução em português, inglês e espanhol',()=>{
 for(const key of ['Telefone com DDD','CEP do pagador','Endereço (rua ou avenida)','Número do endereço','Bairro do pagador','Preencha seus dados, telefone e endereço e aceite os termos para continuar.']){
  assert(locale.includes(JSON.stringify(key)+':['),key);
 }
});
