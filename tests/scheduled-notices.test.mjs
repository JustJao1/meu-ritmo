import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const folder=await mkdtemp(join(tmpdir(),'mr-upcoming-'));
await build({entryPoints:['lib/alerts.ts'],outdir:folder,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'}});
const {upcomingAlerts,dueAlerts}=await import(join(folder,'alerts.mjs'));
const task=(data={})=>({id:'event-one',type:'event',title:'Consulta',date:'2026-11-17',time:'15:00',end:'16:00',amount:0,category:'Outros',body:'',color:'blue',repeat:'none',done:false,pinned:false,archived:false,tags:'',days:[],notify:false,checks:[],...data});
const before=new Date('2026-11-17T17:55:00Z');
const due=new Date('2026-11-17T18:00:00Z');
test('the banner keeps scheduled events pending until their exact minute',()=>{
 const events=[{item:task()}];
 assert.equal(upcomingAlerts(events,before,'America/Sao_Paulo').length,1);
 assert.equal(upcomingAlerts(events,before,'America/Sao_Paulo')[0].time,'15:00');
 assert.equal(upcomingAlerts(events,due,'America/Sao_Paulo').length,0);
 assert.equal(dueAlerts([task()],due,'America/Sao_Paulo').length,1);
});
test('shared events are visible per space and respect cancellation and completion',()=>{
 const sources=[{item:task({id:'same'}),spaceId:'one',spaceName:'Casa'},{item:task({id:'same'}),spaceId:'two',spaceName:'Trabalho'}];
 const future=upcomingAlerts(sources,before,'America/Sao_Paulo');
 assert.equal(future.length,2);
 assert.notEqual(future[0].key,future[1].key);
 for(const patch of [{archived:true},{enabled:false},{done:true}])assert.equal(upcomingAlerts([{item:task(patch)}],before,'America/Sao_Paulo').length,0);
});
test('recurring schedule remains after a previous occurrence has elapsed',()=>{
 const daily=task({date:'2026-11-10',repeat:'daily'});
 const upcoming=upcomingAlerts([{item:daily}],new Date('2026-11-17T18:01:00Z'),'America/Sao_Paulo');
 assert.equal(upcoming[0].date,'2026-11-18');
});
test('visual controls use current theme and shared alarm never edits personal account',async()=>{
 const css=await readFile('app/scheduled-notices.css','utf8');
 const sidebar=await readFile('app/sidebar-shared-polish.css','utf8');
 const player=await readFile('components/alarm-player.tsx','utf8');
 assert.match(css,/var\(--paper\)/);
 assert.match(sidebar,/var\(--theme-side/);
 assert.match(sidebar,/var\(--accent\)/);
 assert.match(player,/!activeEntry.shared/);
 assert.match(player,/setQueue\(old=>\[\.\.\.old,\.\.\.incoming\]\)/);
});
test('workspace attention indicator includes saved personal and shared appointments',async()=>{
 const source=await readFile('app/ritmo.tsx','utf8');
 const spaces=await readFile('components/shared-spaces.tsx','utf8');
 assert.match(source,/personalUpcoming=\{personalUpcoming\}/);
 assert.match(source,/scheduledBySpace=\{sharedPendingBySpace\}/);
 assert.match(source,/mr-workspace-scheduled-counter/);
 assert.match(source,/pendingTotal>0/);
 assert.match(source,/UpcomingEventsInbox upcoming=\{upcoming\}/);
 assert.match(spaces,/personalUpcoming\.length>0/);
 assert.match(spaces,/scheduledBySpace\[s\.id\]/);
});
test('pending badge remains present for events far ahead and does not silently cap the count at 20',()=>{
 const farFuture=task({date:'2027-03-02',repeat:'weekly'});
 const result=upcomingAlerts([{item:farFuture}],before,'America/Sao_Paulo');
 assert.equal(result.length,1);
 assert.equal(result[0].date,'2027-03-02');
 const many=Array.from({length:27},(_,i)=>({item:task({id:'event-'+i})}));
 assert.equal(upcomingAlerts(many,before,'America/Sao_Paulo').length,27);
});
test('no badge for cancelled, disabled or already elapsed one-off event',()=>{
 const timePassed=new Date('2026-11-17T19:00:00Z');
 assert.equal(upcomingAlerts([{item:task()}],timePassed,'America/Sao_Paulo').length,0);
 assert.equal(upcomingAlerts([{item:task({enabled:false})}],before,'America/Sao_Paulo').length,0);
 assert.equal(upcomingAlerts([{item:task({archived:true})}],before,'America/Sao_Paulo').length,0);
});
after(()=>rm(folder,{force:true,recursive:true}));
