import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const tmp=await mkdtemp(join(tmpdir(),'mr-routine-library-'));
await build({entryPoints:['lib/plans.ts'],outfile:join(tmp,'plans.mjs'),bundle:true,format:'esm',platform:'node'});
const {routineLibrary}=await import(join(tmp,'plans.mjs'));
const read=p=>readFileSync(p,'utf8');
const dictionary=read('components/language-selector.tsx');
const translated=pt=>dictionary.includes(JSON.stringify(pt)+':')||dictionary.includes("'"+pt+"':[");

test('ready-made routines are complete, diverse, and include several workout options',()=>{
 assert.ok(routineLibrary.length>=12);
 assert.equal(new Set(routineLibrary.map(t=>t.id)).size,routineLibrary.length);
 for(const routine of routineLibrary){
  assert.ok(routine.name.length>=5,routine.id);
  assert.ok(routine.description.length>=20,routine.id);
  assert.ok(routine.items.length>=8&&routine.items.length<=30,routine.id+' incomplete');
  assert.equal(new Set(routine.items.map(i=>i.title)).size,routine.items.length,routine.id+' repeats a task');
  for(const task of routine.items){
   assert.ok(task.title.length>=6&&task.title.length<=200,routine.id);
   assert.match(task.time,/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/,routine.id);
  }
 }
 assert.ok(routineLibrary.filter(t=>t.category==='Saúde e treino').length>=4);
 for(const id of ['training-strength','training-cardio','training-mobility','training-activity'])assert.ok(routineLibrary.some(t=>t.id===id));
});

test('every routine name, category, description and task has English and Spanish translations',()=>{
 for(const routine of routineLibrary){
  assert.ok(translated(routine.name),'Missing title translation: '+routine.name);
  assert.ok(translated(routine.category),'Missing category translation: '+routine.category);
  assert.ok(translated(routine.description),'Missing description translation: '+routine.description);
  for(const task of routine.items)assert.ok(translated(task.title),'Missing task translation: '+task.title);
 }
});

test('the ready-made library offers category filtering, time previews and preserves plan restrictions',()=>{
 const app=read('components/premium-studio.tsx');
 assert.match(app,/routineLibrary\.filter\(t=>libraryCategory==='Todas'\|\|t.category===libraryCategory\)/);
 assert.match(app,/onApplyTemplate\(items\.map\(x=>\(\{\.\.\.x,title:translateTab\(x.title\)\}\)\),days\)/);
 assert.match(app,/if\(!paid\)\{onUpgrade\('plus'\);return;\}/);
 assert.match(app,/routine-library-count/);
 assert.match(app,/i\.time&&<small>\{i\.time\}<\/small>/);
});

test('social route enforces Pro on the server even when clients forge a routine payload',()=>{
 const api=read('app/api/social/route.ts');
 assert.match(api,/if\(c.category==='rotinas'\|\|c.template\)/);
 assert.match(api,/await userPlan\(u.userId\)!=='pro'/);
 assert.match(api,/status:403/);
 assert.match(api,/c.category!=='rotinas'/);
 assert.match(api,/!c.shareConfirmed/);
 const schema=read('lib/social.ts');
 assert.match(schema,/\.max\(30\)/);
});

test('Social uses a dedicated, accessible custom routine editor without changing regular posts',()=>{
 const community=read('components/community.tsx'),editor=read('components/community-routine-composer.tsx');
 assert.match(community,/onUpgrade:()=>void;plan:Plan/);
 assert.match(community,/if\(plan!=='pro'\)\{onUpgrade\(\);return;\}/);
 assert.match(community,/community-create-actions/);
 assert.match(community,/CommunityRoutineComposer/);
 assert.match(community,/category:'rotinas'/);
 assert.match(editor,/role="dialog" aria-modal="true"/);
 assert.match(editor,/type="time"/);
 assert.match(editor,/onClick=\{\(\)=>move\(index,-1\)\}/);
 assert.match(editor,/onClick=\{\(\)=>move\(index,1\)\}/);
 assert.match(editor,/rows.length<30/);
 assert.match(editor,/shareConfirmed:true/);
 assert.match(editor,/onPublish/);
 assert.match(editor,/setConfirmed\(false\)/);
});

test('the editor and library respect small screens, user themes and translation preferences',()=>{
 const css=read('app/routine-social.css'),layout=read('app/layout.tsx');
 assert.match(layout,/import '\.\/routine-social\.css'/);
 assert.match(css,/@media\(max-width:500px\)/);
 assert.match(css,/var\(--ink\)/);
 assert.match(css,/focus-visible/);
 for(const key of ['Publicar rotina personalizada','Fechar publicação de rotina','Tarefas e horários','Mover para baixo','Saúde e treino'])
  assert.ok(translated(key),'Missing editor translation '+key);
});

after(async()=>{await rm(tmp,{recursive:true,force:true})});
