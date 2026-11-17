import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const folder=await mkdtemp(join(tmpdir(),'ritmo-space-notices-'));
const db=new DatabaseSync(':memory:');
for(const name of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+name,'utf8'));

const prepare=sql=>{const args=[];return{
 bind(...values){args.splice(0,args.length,...values);return this},
 async first(){return db.prepare(sql).get(...args)||null},
 async all(){return {results:db.prepare(sql).all(...args)}},
 async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}}},
 execute(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}}}
}};
globalThis.__spaceNoticeEnv={DB:{prepare,async batch(statements){
 db.exec('BEGIN IMMEDIATE');
 try{const r=statements.map(s=>s.execute());db.exec('COMMIT');return r;}
 catch(e){db.exec('ROLLBACK');throw e;}
}}};
const plugin={name:'space-notifications-test',setup(b){
 b.onResolve({filter:/session$/},()=>({path:'session',namespace:'spacenotices'}));
 b.onResolve({filter:/entitlements$/},()=>({path:'entitlements',namespace:'spacenotices'}));
 b.onResolve({filter:/admin-access$/},()=>({path:'admin-access',namespace:'spacenotices'}));
 b.onResolve({filter:/social$/},()=>({path:'social',namespace:'spacenotices'}));
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'environment',namespace:'spacenotices'}));
 b.onLoad({filter:/.*/,namespace:'spacenotices'},({path})=>({loader:'js',contents:
  path==='session'?'export const getUser=async()=>globalThis.__spaceNoticeUser;':
  path==='entitlements'?'export const planAccess=async(id)=>({plan:id===globalThis.__spaceNoticeOwner?\'pro\':\'free\'});':
  path==='admin-access'?'export const registerMember=async()=>{};export const sameOrigin=req=>req.headers.get(\'origin\')===new URL(req.url).origin;':
  path==='social'?'export const socialRate=async()=>true;':
  'export const env=globalThis.__spaceNoticeEnv;'
 }))
}};
await build({entryPoints:{spaces:'app/api/spaces/route.ts',notifications:'app/api/spaces/notifications/route.ts'},outdir:folder,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'},plugins:[plugin]});
const spaces=await import(join(folder,'spaces.mjs'));
const notifications=await import(join(folder,'notifications.mjs'));
const a='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const b='bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const c='cccccccc-3333-4333-8333-cccccccccccc';
globalThis.__spaceNoticeOwner=a;
const user=id=>{globalThis.__spaceNoticeUser={userId:id,email:id+'@test.example',displayName:id,fullName:id};};
const post=(body,origin='https://example.test')=>spaces.POST(new Request('https://example.test/api/spaces',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
const getNotices=()=>notifications.GET(new Request('https://example.test/api/spaces/notifications'));
const read=id=>notifications.POST(new Request('https://example.test/api/spaces/notifications',{method:'POST',headers:{Origin:'https://example.test','Content-Type':'application/json'},body:JSON.stringify({action:'read',spaceId:id})}));
const item=id=>({id,type:'task',title:'Nova tarefa '+id,date:'2026-11-17',time:'',end:'',amount:0,category:'Outros',body:'',color:'blue',repeat:'none',done:false,pinned:false,archived:false,tags:'',days:[],notify:false,checks:[]});
let id,revision=0;

test('members receive only activity added by another account; unread persists until opened',async()=>{
 user(a);const created=await post({action:'create',name:'Grupo de planejamento'});assert.equal(created.status,201);
 const space=(await created.json()).space;id=space.id;
 user(b);assert.equal((await post({action:'join',code:space.joinCode})).status,200);
 user(a);const first=await post({action:'update',id,revision,items:[item('first')]});assert.equal(first.status,200,await first.clone().text());revision++;
 assert.equal((await (await getNotices()).json()).unreadTotal,0,'actor does not get their own alert');
 user(b);const inbox=await(await getNotices()).json();
 assert.equal(inbox.unreadTotal,1);assert.equal(inbox.unreadBySpace[id],1);
 assert.equal(inbox.notifications[0].spaceName,'Grupo de planejamento');
 assert.equal(inbox.notifications[0].itemTitle,'Nova tarefa first');assert.equal(inbox.notifications[0].itemCount,1);
 assert.equal((await(await getNotices()).json()).unreadTotal,1,'a fresh GET cannot clear unread');
 assert.equal((await read(id)).status,200);
 assert.equal((await(await getNotices()).json()).unreadTotal,0);
});
test('edits and stale updates never create phantom alerts; a batch adds one aggregated event',async()=>{
 user(b);const oldRevision=revision;
 const edited=await post({action:'update',id,revision,items:[{...item('first'),title:'Tarefa editada'}]});assert.equal(edited.status,200);revision++;
 user(a);assert.equal((await(await getNotices()).json()).unreadTotal,0);
 user(b);const stale=await post({action:'update',id,revision:oldRevision,items:[item('phantom')]});
 assert.equal(stale.status,409);
 user(a);assert.equal((await(await getNotices()).json()).unreadTotal,0);
 user(b);const batch=await post({action:'update',id,revision,items:[item('first'),item('second'),item('third')]});
 assert.equal(batch.status,200,await batch.clone().text());revision++;
 user(a);const inbox=await(await getNotices()).json();
 assert.equal(inbox.unreadTotal,1,'one event per batch, not a badge for every item');
 assert.equal(inbox.notifications[0].itemCount,2);
 assert.equal(inbox.notifications[0].itemTitle,'Nova tarefa second');
});
test('unknown member cannot read another account\'s messages; membership removal clears old notices',async()=>{
 user(c);assert.equal((await read(id)).status,404);
 assert.equal((await(await getNotices()).json()).unreadTotal,0);
 user(a);assert.equal((await post({action:'remove',id,userId:b})).status,200);
 user(b);assert.equal((await(await getNotices()).json()).unreadTotal,0);
 assert.equal((await read(id)).status,404);
 user(a);assert.equal((await read(id)).status,200);
 assert.equal((await(await getNotices()).json()).unreadTotal,0);
 assert.equal((await post({action:'delete',id,confirmName:'Grupo de planejamento'})).status,200);
 assert.equal(db.prepare('SELECT count(*) AS count FROM shared_space_notifications').get().count,0);
});
after(async()=>{db.close();await rm(folder,{recursive:true,force:true});delete globalThis.__spaceNoticeEnv;delete globalThis.__spaceNoticeUser;delete globalThis.__spaceNoticeOwner;});
