import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const api=readFileSync(new URL('../app/api/appearance-sync/route.ts',import.meta.url),'utf8');
const studio=readFileSync(new URL('../components/premium-studio.tsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../drizzle/0009_appearance_links.sql',import.meta.url),'utf8');
test('appearance link is scoped, authenticated and revocable',()=>{assert.match(api,/getUser\(\)/);assert.match(api,/hash\(token\)/);assert.match(api,/DELETE/);assert.match(api,/expires_at>\?/);assert.match(api,/effectiveAppearance\(data,await userPlan/);assert.doesNotMatch(api,/return json\(\{.*payload/);assert.match(migration,/token_hash TEXT PRIMARY KEY/);});
test('pairing remains opt-in inside the existing appearance studio',()=>{assert.match(studio,/Gerar chave para o Lite/);assert.match(studio,/Revogar vinculação anterior/);});
