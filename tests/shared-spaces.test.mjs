import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const folder=await mkdtemp(join(tmpdir(),'ritmo-spaces-'));
const db=new DatabaseSync(':memory:');
for(const file of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())
 db.exec(await readFile('drizzle/'+file,'utf8'));
const prepare=sql=>{const args=[];return {
 bind(...values){args.splice(0,args.length,...values);return this},
 async first(){return db.prepare(sql).get(...args)||null},
 async all(){return {results:db.prepare(sql).all(...args)}},
 async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}}},
 execute(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}}}
}};
globalThis.__testSpacesEnv={DB:{prepare,async batch(statements){
 db.exec('BEGIN IMMEDIATE');
 try{const r=statements.map(s=>s.execute());db.exec('COMMIT');return r}
 catch(e){db.exec('ROLLBACK');throw e}
}}};
const plugin={name:'spaces-test',setup(b){
 b.onResolve({filter:/session$/},()=>({path:'session',namespace:'spaces'}));
 b.onResolve({filter:/entitlements$/},()=>({path:'entitlements',namespace:'spaces'}));
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'spaces'}));
 b.onLoad({filter:/.*/,namespace:'spaces'},({path})=>({
  loader:'js',
  contents:path==='session'?'export const getUser=async()=>globalThis.__testSpacesUser;':
   path==='entitlements'?'export const planAccess=async(id)=>({plan:id===globalThis.__testSpacesOwner?\'pro\':\'free\',source:id===globalThis.__testSpacesOwner?\'subscription\':\'free\'});':
   'export const env=globalThis.__testSpacesEnv;'
 }))
}};
await build({entryPoints:['app/api/spaces/route.ts'],outfile:join(folder,'spaces.mjs'),bundle:true,platform:'node',format:'esm',plugins:[plugin]});
const api=await import(join(folder,'spaces.mjs'));
const a='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',b='bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',c='cccccccc-3333-4333-8333-cccccccccccc';
globalThis.__testSpacesOwner=a;
const user=id=>{globalThis.__testSpacesUser={userId:id,email:id+'@test.example',displayName:id,fullName:id};};
function post(body,origin='https://example.test'){
 return api.POST(new Request('https://example.test/api/spaces',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
}
function get(id){return api.GET(new Request('https://example.test/api/spaces'+(id?'?id='+id:'')))}
const defaultItem=(id)=>({id,type:'task',title:'Revisar pauta',date:'2026-11-15',time:'',end:'',amount:0,category:'Outros',body:'Tarefas do grupo',color:'blue',repeat:'none',done:false,pinned:false,archived:false,tags:'',days:[],notify:false,checks:[]});
let id,code,revision=0;
test('only paid Pro creates; everyone can join; list never discloses join codes to members',async()=>{
 user(b);
 assert.equal((await post({action:'create',name:'Nosso grupo'})).status,403);
 user(a);
 assert.equal((await post({action:'create',name:'Nosso grupo'})).status,201);
 const result=await (await get()).json();assert.equal(result.spaces.length,1);
 id=result.spaces[0].id;code=result.spaces[0].joinCode;
 assert.match(code,/^[A-HJ-NP-Z2-9]{12}$/);
 user(b);
 assert.equal((await post({action:'join',code})).status,200);
 const my=await (await get()).json();
 assert.equal(my.spaces.length,1);assert.equal(my.spaces[0].joinCode,undefined);
 const detail=await (await get(id)).json();
 assert.equal(detail.space.owner,false);
 assert.equal(detail.space.joinCode,undefined);
});
test('only members read or write; optimistic revisions block overwrites',async()=>{
 user(c);
 assert.equal((await get(id)).status,404);
 assert.equal((await post({action:'update',id,revision,items:[defaultItem('first')]})).status,404);
 user(b);
 assert.equal((await post({action:'update',id,revision,items:[defaultItem('first')]})).status,200);
 assert.equal((await post({action:'update',id,revision,items:[]})).status,409);
 revision=1;
 const detail=await (await get(id)).json();
 assert.equal(detail.space.items[0].title,'Revisar pauta');
 assert.equal(detail.space.members.length,2);
});
test('personal expenses and theme cannot be injected into shared state',async()=>{
 user(b);
 const bad={...defaultItem('secret'),type:'expense',amount:230};
 assert.equal((await post({action:'update',id,revision,items:[bad]})).status,400);
 assert.equal((await post({action:'update',id,revision,items:[{...defaultItem('style'),appearance:{theme:'blackout'}}]})).status,200);
 // Zod strips unknown per-item metadata; there is never a shared appearance field.
 const detail=await(await get(id)).json();
 assert.equal(detail.space.items[0].appearance,undefined);
 revision=2;
});
test('creator can rotate invite, remove a member and old code no longer works',async()=>{
 user(b);assert.equal((await post({action:'rotate',id})).status,403);
 user(a);
 const changed=await(await post({action:'rotate',id})).json();
 assert.notEqual(changed.joinCode,code);
 user(c);assert.equal((await post({action:'join',code})).status,404);
 assert.equal((await post({action:'join',code:changed.joinCode})).status,200);
 user(b);assert.equal((await post({action:'remove',id,userId:c})).status,403);
 user(a);
 assert.equal((await post({action:'remove',id,userId:b})).status,200);
 user(b);
 assert.equal((await get(id)).status,404);
 assert.equal((await post({action:'update',id,revision,items:[]})).status,404);
});
test('personal account rows stay unchanged by shared-space updates',()=>{
 assert.equal(db.prepare('SELECT count(*) n FROM accounts').get().n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM shared_spaces').get().n,1);
});

test('batch save accepts five distinct shared item types with advanced fields',async()=>{
 user(a);
 const detail=await (await get(id)).json();
 const rev=detail.space.revision;
 const items=[
  {...defaultItem('task-a'),type:'task',title:'Revisão em grupo',repeat:'weekly',checks:['Primeira etapa','Segunda etapa'],tags:'equipe'},
  {...defaultItem('event-a'),type:'event',title:'Reunião da equipe',time:'08:00',end:'09:00'},
  {...defaultItem('reminder-a'),type:'reminder',title:'Enviar pauta',time:'10:00'},
  {...defaultItem('note-a'),type:'note',title:'Notas da reunião',color:'pink',pinned:true},
  {...defaultItem('message-a'),type:'message',title:'Recado importante',color:'yellow'}
 ];
 const response=await post({action:'update',id,revision:rev,items});
 assert.equal(response.status,200,await response.clone().text());
 const stored=(await (await get(id)).json()).space.items;
 assert.deepEqual(stored.map(item=>item.type),['task','event','reminder','note','message']);
 assert.deepEqual(stored[0].checks,['Primeira etapa','Segunda etapa']);
 assert.equal(stored[0].repeat,'weekly');
 assert.equal(stored[3].color,'pink');
 assert.equal(stored[3].pinned,true);
});
test('Pro account can create only two spaces and deleting one frees its slot',async()=>{
 user(a);
 const second=await post({action:'create',name:'Espaço secundário'});
 assert.equal(second.status,201);
 const secondId=(await second.json()).space.id;
 const list=await (await get()).json();
 assert.equal(list.createdCount,2);
 assert.equal(list.maxCreated,2);
 const rejected=await post({action:'create',name:'Terceiro espaço'});
 assert.equal(rejected.status,409);
 assert.match((await rejected.json()).error,/2 espaços/);
 user(c);
 assert.equal((await post({action:'rename',id:secondId,name:'Nome invadido'})).status,404);
 assert.equal((await post({action:'delete',id:secondId,confirmName:'Espaço secundário'})).status,404);
 user(a);
 assert.equal((await post({action:'rename',id:secondId,name:'Trabalho de equipe'})).status,200);
 assert.equal((await post({action:'delete',id:secondId,confirmName:'Nome incorreto'})).status,400);
 assert.equal((await (await get(secondId)).json()).space.name,'Trabalho de equipe');
 assert.equal((await post({action:'delete',id:secondId,confirmName:'Trabalho de equipe'})).status,200);
 assert.equal((await get(secondId)).status,404);
 const next=await post({action:'create',name:'Novo espaço'});
 assert.equal(next.status,201);
 assert.equal((await (await get()).json()).createdCount,2);
});
after(async()=>{db.close();await rm(folder,{force:true,recursive:true});delete globalThis.__testSpacesEnv;delete globalThis.__testSpacesUser;delete globalThis.__testSpacesOwner});
