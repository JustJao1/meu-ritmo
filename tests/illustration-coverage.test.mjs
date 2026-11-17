import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const folder=await mkdtemp(join(process.cwd(),'.mr-category-art-'));
await build({entryPoints:['components/context-illustration.tsx','components/category-illustration.tsx'],outdir:folder,bundle:true,format:'esm',platform:'node',jsx:'automatic',packages:'external',outExtension:{'.js':'.mjs'}});
const {default:Context}=await import(join(folder,'context-illustration.mjs'));
const {default:Category}=await import(join(folder,'category-illustration.mjs'));
after(()=>rm(folder,{recursive:true,force:true}));
test('category artwork stays decorative and never introduces controls or tab stops',()=>{
 for(const context of ['Hoje','Agenda','Gastos','Notas','Rotina','Comunidade','Planos','Administração','Meu Ritmo App','Opiniões e respostas','Alarmes e lembretes','Guia e ajuda','Meu estilo','Configurações','Contas','Administradores','Códigos','Acessos','Opiniões','Histórico','Descontos','Moderação','Lançamento','Cobranças','Privacidade','Termos','Reembolso','Perfil','Pix']){
  for(const Component of [Context,Category]){
   const html=renderToStaticMarkup(React.createElement(Component,{context,name:context}));
   assert.match(html,/aria-hidden="true"/);
   assert.doesNotMatch(html,/<(?:button|input|a)(?:\s|>)/);
   assert.doesNotMatch(html,/tabindex|undefined|\bNaN\b/i);
  }
 }
});
test('daily phrase keeps its changing message without duplicating the sidebar plans action',()=>{
 const app=readFileSync('app/ritmo.tsx','utf8');
 const card=app.match(/<div className="planpitch daily-pitch">([\s\S]*?)<\/div>/)?.[1];
 assert(card);
 assert.match(card,/<DailyMotivation\s*\/>/);
 assert.doesNotMatch(card,/<button|Conhecer os planos/);
 assert.match(app,/setPanel\('Planos'\)[\s\S]*?name="Planos"/);
});
