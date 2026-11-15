import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const dir=await mkdtemp(join(tmpdir(),'ritmo-names-'));
await build({entryPoints:['lib/profile-name-policy.ts'],outfile:join(dir,'names.mjs'),bundle:true,platform:'node',format:'esm'});
const {nameIssue}=await import(join(dir,'names.mjs'));

test('ordinary names stay allowed including equal display names and names with innocent substrings',()=>{
 for(const name of ['João Victor','Ana Maria','Computador','Luiz Eduardo','Sofia','María José','João 2026'])assert.equal(nameIssue(name,'display'),null,name);
 for(const username of ['joao_2026','ana_maria','computador','rita123'])assert.equal(nameIssue(username,'username'),null,username);
});
test('offensive words, obfuscations, and impersonation are rejected in both public name types',()=>{
 for(const name of ['P.u.t.a','P_U_T_A','FDP','Caralho','Nome Merda','NeoNazi','Asshole','Meu Ritmo','Equipe Meu Ritmo'])assert.notEqual(nameIssue(name,'display'),null,name);
 for(const username of ['admin','admin123','suporte','moderador','puta','puta123','p_u_t_a','fdp','meuritmo'])assert.notEqual(nameIssue(username,'username'),null,username);
});
test.after(async()=>rm(dir,{recursive:true,force:true}));
