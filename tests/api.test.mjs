import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'ritmo-api-test-'));
const virtual={name:'test-runtime',setup(b){b.onResolve({filter:/session$/},()=>({path:'auth',namespace:'test'}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},({path})=>({contents:path==='auth'?'export async function getUser(){return globalThis.__testUser||null}':'export const env=globalThis.__testEnv;'}));}};
const db=new DatabaseSync(':memory:');for(const file of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+file,'utf8'));
const binding={prepare(sql){const st=db.prepare(sql);let args=[];return {bind(...a){args=a;return this},async first(){return st.get(...args)||null},async run(){const r=st.run(...args);return {meta:{changes:r.changes}}}}}};
globalThis.__testEnv={DB:binding};
await build({entryPoints:['app/api/state/route.ts'],outfile:join(dir,'api.mjs'),bundle:true,platform:'node',format:'esm',plugins:[virtual]});
for(const name of ['checkout','portal','webhook'])await build({entryPoints:['app/api/billing/'+name+'/route.ts'],outfile:join(dir,name+'.mjs'),bundle:true,platform:'node',format:'esm',plugins:[virtual]});
await build({entryPoints:['app/api/reports/route.ts'],outfile:join(dir,'reports.mjs'),bundle:true,platform:'node',format:'esm',plugins:[virtual]});
const reports=await import(join(dir,'reports.mjs'));
const api=await import(join(dir,'api.mjs'));
const item={id:'one',type:'task',title:'Teste privado',date:'2026-11-12',time:'',end:'',amount:0,category:'Outros',body:'',color:'blue',repeat:'none',done:false,pinned:false,archived:false,tags:'',days:[],notify:false,checks:[]};
const payload=(items=[item],revision=0)=>({data:{items,budget:2000,onboarded:true,timezone:'America/Sao_Paulo'},revision});
const put=(p,origin='https://test.local')=>api.PUT(new Request('https://test.local/api/state',{method:'PUT',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(p)}));
test('dados exigem identidade no servidor',async()=>{globalThis.__testUser=null;assert.equal((await api.GET()).status,401);assert.equal((await put(payload())).status,401)});
test('criação, leitura, edição e exclusão persistem por usuário e revisão',async()=>{globalThis.__testUser={userId:'A'};assert.equal((await put(payload())).status,200);let a=await(await api.GET()).json();assert.equal(a.data.items[0].title,'Teste privado');assert.equal(a.revision,1);globalThis.__testUser={userId:'B'};assert.equal((await(await api.GET()).json()).data,null);assert.equal((await put(payload([{...item,title:'Outro usuário'}]))).status,200);globalThis.__testUser={userId:'A'};assert.equal((await(await api.GET()).json()).data.items[0].title,'Teste privado');assert.equal((await put(payload([{...item,title:'Editado'}],1))).status,200);assert.equal((await(await api.GET()).json()).data.items[0].title,'Editado');assert.equal((await put(payload([],2))).status,200);assert.equal((await(await api.GET()).json()).data.items.length,0)});
test('conflitos, origem externa, campos inválidos e limite de pins são rejeitados',async()=>{globalThis.__testUser={userId:'A'};assert.equal((await put(payload([item],0))).status,409);assert.equal((await put(payload([item],3),'https://evil.local')).status,403);assert.equal((await put(payload([{...item,type:'expense',amount:-2}],3))).status,400);assert.equal((await put(payload(Array.from({length:4},(_,i)=>({...item,id:String(i),type:'note',pinned:true})),3))).status,403);assert.equal((await(await api.GET()).json()).revision,3)});
test('assinatura sem credenciais não cria checkout, portal ou pagamento fictício',async()=>{globalThis.__testUser={userId:'A'};for(const name of ['checkout','portal','webhook']){const module=await import(join(dir,name+'.mjs'));const response=await module.POST(new Request('https://test.local/api/billing/'+name,{method:'POST',headers:{origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify({price:'plus_month'})}));assert.equal(response.status,503);assert((await response.json()).error.includes('configurad'));}});
test('orçamento e justificativa de excesso são gratuitos e persistem',async()=>{globalThis.__testUser={userId:'budget'};const p=payload([{...item,type:'expense',amount:150}]);p.data.budget=100;p.data.budgetReviews={'2026-11':{reason:'Despesa inesperada de manutenção',total:150,budget:100,at:new Date().toISOString()}};assert.equal((await put(p)).status,200);assert.equal((await(await api.GET()).json()).data.budgetReviews['2026-11'].reason,'Despesa inesperada de manutenção');});
test('cliente não pode liberar temas ou modelos próprios sem assinatura',async()=>{globalThis.__testUser={userId:'free-features'};const p=payload();p.data.appearance={theme:'tide',accent:'#3868ac',badge:'sun',noteStyle:'dots',density:'airy',titleStyle:'sans'};p.data.plan='pro';assert.equal((await put(p)).status,403);delete p.data.appearance;p.data.routineTemplates=[{id:'a',name:'Meu modelo',items:[{title:'Tarefa',time:''}]}];assert.equal((await put(p)).status,403);assert.equal((await reports.GET(new Request('https://test.local/api/reports?month=2026-11'))).status,403);});
test('cinco temas são gratuitos e outras personalizações continuam protegidas',async()=>{
 globalThis.__testUser={userId:'free-palette'};
 const allowed=[['paper','#e9785d'],['tide','#3868ac'],['clay','#ae503b'],['olive','#677c3c'],['midnight','#fa9077']];
 let revision=0;
 for(const [theme,accent] of allowed){
  const p=payload([item],revision);
  p.data.appearance={theme,accent,badge:'initial',noteStyle:'plain',density:'airy',titleStyle:'sans'};
  assert.equal((await put(p)).status,200,'Tema gratuito não foi salvo: '+theme);
  revision++;
  const saved=await(await api.GET()).json();
  assert.equal(saved.data.appearance.theme,theme);
  assert.equal(saved.data.appearance.accent,accent);
  assert.equal(saved.plan,'free');
 }
 for(const invalid of [
  {theme:'forest',accent:'#a6d2a0',badge:'initial',noteStyle:'plain',density:'airy',titleStyle:'sans'},
  {theme:'tide',accent:'#123456',badge:'initial',noteStyle:'plain',density:'airy',titleStyle:'sans'},
  {theme:'tide',accent:'#3868ac',badge:'sun',noteStyle:'plain',density:'airy',titleStyle:'sans'},
 ]){
  const p=payload([item],revision);p.data.appearance=invalid;
  assert.equal((await put(p)).status,403,'Permissão indevida para '+JSON.stringify(invalid));
 }
});
test('Plus e Pro são obtidos no servidor e benefícios expiram sem apagar dados',async()=>{globalThis.__testUser={userId:'paid'};const until=Math.floor(Date.now()/1000)+3600;db.prepare('INSERT INTO subscriptions(user_id,subscription_id,plan,status,updated_at,valid_until) VALUES (?,?,?,?,?,?)').run('paid','sub_test','plus','active',1,until);const appearance={theme:'tide',accent:'#3868ac',badge:'sun',noteStyle:'dots',density:'airy',titleStyle:'editorial'};const p=payload(Array.from({length:4},(_,i)=>({...item,id:String(i),type:'note',pinned:true})));p.data.appearance=appearance;assert.equal((await put(p)).status,200);assert.equal((await(await api.GET()).json()).plan,'plus');const custom=payload(p.data.items,1);custom.data.appearance={...appearance,accent:'#123456'};assert.equal((await put(custom)).status,403);db.prepare('UPDATE subscriptions SET plan=? WHERE user_id=?').run('pro','paid');assert.equal((await put(custom)).status,200);assert.equal((await reports.GET(new Request('https://test.local/api/reports?month=2026-11'))).status,200);db.prepare('UPDATE subscriptions SET valid_until=1 WHERE user_id=?').run('paid');const expired=await(await api.GET()).json();assert.equal(expired.plan,'free');assert.equal(expired.data.items.length,4);assert.equal(expired.data.appearance.accent,'#123456');const edit={data:{...expired.data,items:expired.data.items.map((x,i)=>i?x:{...x,title:'Ainda editável'})},revision:expired.revision};assert.equal((await put(edit)).status,200);assert.equal((await reports.GET(new Request('https://test.local/api/reports?month=2026-11'))).status,403);});
after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});
