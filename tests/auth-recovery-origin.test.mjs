import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSync} from 'esbuild';

const output=buildSync({entryPoints:['lib/auth-redirect.ts'],write:false,bundle:true,format:'cjs',platform:'node'}).outputFiles[0].text;
const exports={};
const module={exports};
// eslint-disable-next-line no-new-func
new Function('exports','module',output)(exports,module);
const {recoveryRedirect}=module.exports;

test('production password reset stays on the public domain',()=>{
 assert.equal(recoveryRedirect('https://meuritmo.net/api/auth/recover'),'https://meuritmo.net/nova-senha');
});
test('sandbox password reset never redirects to the production site',()=>{
 assert.equal(recoveryRedirect('https://meu-ritmo-asaas-sandbox.silva-joao-232334.workers.dev/api/auth/recover'),
  'https://meu-ritmo-asaas-sandbox.silva-joao-232334.workers.dev/nova-senha');
});
test('the API route uses the environment-aware destination',()=>{
 const route=readFileSync('lib/auth-routes.ts','utf8');
 assert.match(route,/encodeURIComponent\(recoveryRedirect\(req\.url\)\)/);
 assert.doesNotMatch(route,/encodeURIComponent\('https:\/\/meuritmo\.net\/nova-senha'\)/);
});
