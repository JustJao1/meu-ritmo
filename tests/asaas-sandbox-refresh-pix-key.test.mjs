import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('scripts/asaas-sandbox-refresh-pix-key.mjs','utf8');
const w=readFileSync('.github/workflows/asaas-sandbox-refresh-pix-key.yml','utf8');
test('new Pix key maintenance is sandbox only, never deletes old keys and tests checkout',()=>{
 assert.match(s,/ASAAS_MODE!=='sandbox'/);assert.match(s,/\$aact_hmlg_/);
 assert.match(s,/\{type:'EVP'\}/);
 assert.doesNotMatch(s,/https:\/\/api\.asaas\.com/);
 assert.doesNotMatch(s,/addressKeys[^\n]*DELETE|\/addressKeys',\s*'DELETE'/);
 assert.match(w,/environment: sandbox/);
 assert.match(w,/asaas-hosted-pix-sandbox-smoke\.mjs/);
});
