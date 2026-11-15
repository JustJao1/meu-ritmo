import {test,after} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {build} from 'esbuild';import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {deflateSync} from 'node:zlib';
const dir=await mkdtemp(join(tmpdir(),'ritmo-social-')),db=new DatabaseSync(':memory:');for(const f of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+f,'utf8'));
function prep(sql){const st=db.prepare(sql);let args=[];return {bind(...a){args=a;return this},async first(){return st.get(...args)||null},async all(){return {results:st.all(...args)}},async run(){return this.execute()},execute(){const r=st.run(...args);return {meta:{changes:r.changes}}}}}const objects=new Map();globalThis.__socialEnv={ADMIN_OWNER_EMAIL:'owner@test.example',ADMIN_OWNER_USER_ID:'owner',DB:{prepare:prep,async batch(s){db.exec('BEGIN IMMEDIATE');try{const r=s.map(x=>x.execute());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}},BUCKET:{async put(k,b,o){objects.set(k,{body:b,httpMetadata:o?.httpMetadata})},async get(k){return objects.get(k)||null},async delete(k){objects.delete(k)}}};
const plugin={name:'identity',setup(b){b.onResolve({filter:/session$/},()=>({path:'auth',namespace:'test'}));b.onResolve({filter:/avatar-store$/},()=>({path:'storage',namespace:'test'}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},({path})=>({contents:path==='storage'?'export const avatarStore=globalThis.__socialEnv.BUCKET;':path==='auth'?'export async function getUser(){return globalThis.__socialUser}':'export const env=globalThis.__socialEnv'}));}};const api={};for(const [name,path]of Object.entries({profile:'app/api/profile/route.ts',social:'app/api/social/route.ts',avatar:'app/api/avatar/route.ts',discount:'app/api/admin/discounts/route.ts',checkout:'app/api/billing/checkout/route.ts',quote:'app/api/billing/quote/route.ts',webhook:'app/api/billing/webhook/asaas/route.ts',account:'app/api/account/route.ts',privacy:'app/api/privacy/route.ts'})){await build({entryPoints:[path],outfile:join(dir,name+'.mjs'),bundle:true,platform:'node',format:'esm',plugins:[plugin]});api[name]=await import(join(dir,name+'.mjs'))}
const who=(id)=>globalThis.__socialUser=id?{userId:id,email:id+'@test.example',displayName:id,fullName:id}:null;const request=(name,body,method='POST',origin='https://test.example')=>api[name][method](new Request('https://test.example/api/'+name,{method,headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));const feed=(q='')=>api.social.GET(new Request('https://test.example/api/social'+q));const profile=(username,name)=>({username,name,bio:'Sobre a rotina',accept:true,adult:true});let postId;
for(const id of ['owner','alice','bob']){who(id);await api.account.GET()}
test('perfil exige identidade, aceite, maioridade declarada e nomes únicos',async()=>{who(null);assert.equal((await request('profile',profile('alice','Alice'),'PUT')).status,401);who('alice');assert.equal((await request('profile',{...profile('alice','Alice'),adult:false},'PUT')).status,400);assert.equal((await request('profile',profile('alice','Alice'),'PUT')).status,200);who('bob');assert.equal((await request('profile',profile('alice','Bob'),'PUT')).status,409);assert.equal((await request('profile',profile('bobrotina','Bob'),'PUT')).status,200);});
test('nome de usuário respeita 30 dias e exibição 14; bio não reinicia o prazo',async()=>{who('alice');assert.equal((await request('profile',profile('alice_novo','Alice'),'PUT')).status,409);assert.equal((await request('profile',profile('alice','Alice nova'),'PUT')).status,409);const before=db.prepare('SELECT username_changed_at,name_changed_at FROM profiles WHERE user_id=?').get('alice');assert.equal((await request('profile',{...profile('alice','Alice'),bio:'Outra bio'},'PUT')).status,200);assert.deepEqual(db.prepare('SELECT username_changed_at,name_changed_at FROM profiles WHERE user_id=?').get('alice'),before);db.prepare('UPDATE profiles SET username_changed_at=?,name_changed_at=? WHERE user_id=?').run(Math.floor(Date.now()/1000)-31*86400,Math.floor(Date.now()/1000)-15*86400,'alice');assert.equal((await request('profile',profile('alice_novo','Alice nova'),'PUT')).status,200);});
test('publicações só compartilham modelo confirmado e não incluem dados privados',async()=>{who('alice');db.prepare('INSERT INTO accounts(user_id,payload,revision) VALUES (?,?,?)').run('alice',JSON.stringify({segredo:'MEUS_GASTOS_PRIVADOS'}),1);const body={action:'post',category:'rotinas',title:'Manhã organizada',body:'Um modelo para adaptar',template:[{title:'Revisar agenda',time:'08:00'}]};assert.equal((await request('social',body)).status,400);const r=await request('social',{...body,shareConfirmed:true});assert.equal(r.status,200);postId=(await r.json()).id;who('bob');const f=await(await feed()).json();assert.equal(f.posts.length,1);assert.equal(f.posts[0].template[0].title,'Revisar agenda');assert(!JSON.stringify(f).includes('MEUS_GASTOS_PRIVADOS'));assert(!JSON.stringify(f).includes('alice@test.example'));assert.equal((await request('social',{action:'remove',postId})).status,403);});
test('respostas, bloqueio bilateral e denúncias respeitam permissões',async()=>{who('bob');assert.equal((await request('social',{action:'comment',postId,body:'Obrigado pelo modelo'})).status,200);const alice=db.prepare('SELECT id FROM profiles WHERE user_id=?').get('alice');assert.equal((await request('social',{action:'block',profileId:alice.id,enabled:true})).status,200);assert.equal((await(await feed()).json()).posts.length,0);who('alice');assert.equal((await(await feed()).json()).posts[0].username,'alice_novo');who('bob');await request('social',{action:'block',profileId:alice.id,enabled:false});assert.equal((await request('social',{action:'report',postId,reason:'Verificar publicação de teste'})).status,200);assert.equal((await feed('?moderation=1')).status,403);who('owner');assert.equal((await(await feed('?moderation=1')).json()).reports.length,1);assert.equal((await request('social',{action:'suspend',profileId:alice.id,enabled:true})).status,200);who('alice');assert.equal((await request('social',{action:'post',category:'conversas',title:'Tentativa',body:'Perfil suspenso'})).status,403);who('owner');await request('social',{action:'suspend',profileId:alice.id,enabled:false});});
function png(){const crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0};const chunk=(type,data)=>{const b=Buffer.concat([Buffer.from(type),data]),n=Buffer.alloc(4),c=Buffer.alloc(4);n.writeUInt32BE(data.length);c.writeUInt32BE(crc(b));return Buffer.concat([n,b,c])};const h=Buffer.from([0,0,0,1,0,0,0,1,8,6,0,0,0]);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('tEXt',Buffer.from('private\0SECRET_METADATA')),chunk('IDAT',deflateSync(Buffer.from([0,255,0,0,255]))),chunk('IEND',Buffer.alloc(0))])}
test('foto recusa SVG e remove metadados PNG no servidor',async()=>{who('bob');assert.equal((await api.avatar.POST(new Request('https://test.example/api/avatar',{method:'POST',headers:{origin:'https://test.example','Content-Type':'image/svg+xml'},body:'<svg/>'}))).status,400);const r=await api.avatar.POST(new Request('https://test.example/api/avatar',{method:'POST',headers:{origin:'https://test.example','Content-Type':'image/png'},body:png()}));assert.equal(r.status,200);assert.equal(objects.size,1);assert(!Buffer.from([...objects.values()][0].body).includes(Buffer.from('SECRET_METADATA')));});
test('descontos podem ser rascunhados sem pagamento e não liberam planos gratuitos',async()=>{who('bob');assert.equal((await request('discount',{action:'create'})).status,403);who('owner');const r=await request('discount',{action:'create',code:'DESCONTO10',label:'Primeira cobrança',plan:'all',kind:'percent',value:10,expiresAt:Math.floor(Date.now()/1000)+86400,maxUses:10});assert.equal(r.status,200);assert.equal(db.prepare('SELECT stripe_id FROM discount_codes WHERE code=?').get('DESCONTO10').stripe_id,null);});
test('uniqueness before confirmation and profile reports',async()=>{
 const now=Math.floor(Date.now()/1000);
 db.prepare('INSERT INTO auth_pending_profiles(user_id,username,name,accepted_at,created_at) VALUES (?,?,?,?,?)').run('pending_a','reserved_name','Example',now,now);
 assert.throws(()=>db.prepare('INSERT INTO auth_pending_profiles(user_id,username,name,accepted_at,created_at) VALUES (?,?,?,?,?)').run('pending_b','RESERVED_NAME','Other',now,now),/UNIQUE/i);
 who('eve');
 assert.equal((await request('profile',profile('reserved_name','Alice nova'),'PUT')).status,409);
 assert.equal((await request('profile',profile('eve_person','Alice nova'),'PUT')).status,200);
 const alice=db.prepare('SELECT id FROM profiles WHERE user_id=?').get('alice');
 who('bob');
 const report={action:'report',profileId:alice.id,reason:'Nome inadequado para a comunidade'};
 assert.equal((await request('social',report)).status,200);
 assert.equal((await request('social',report)).status,200);
 assert.equal(db.prepare('SELECT count(*) AS n FROM social_reports WHERE reporter_id=? AND profile_id=?').get('bob',alice.id).n,1);
 who('owner');
 const result=await (await feed('?moderation=1')).json();
 assert(result.reports.some(r=>r.profile_id===alice.id&&r.username==='alice_novo'));
});
test('cotação Asaas mostra desconto sem criar cobrança ou consumir cupom',async()=>{
 who('bob');
 const before=db.prepare('SELECT count(*) AS n FROM asaas_coupon_uses').get().n;
 const regular=await request('quote',{price:'plus_month'});
 assert.equal(regular.status,200);
 assert.deepEqual(await regular.json(),{plan:'plus_month',firstAmountCents:1990,renewalAmountCents:1990,savingsCents:0,discountApplied:false,interval:'month',checkoutAvailable:false});
 const discounted=await request('quote',{price:'plus_month',discountCode:'DESCONTO10'});
 assert.equal(discounted.status,200);
 const v=await discounted.json();
 assert.equal(v.firstAmountCents,1791);
 assert.equal(v.renewalAmountCents,1990);
 assert.equal(v.savingsCents,199);
 assert.equal(v.discountApplied,true);
 assert.equal((await request('quote',{price:'pro_month',discountCode:'INVALID'})).status,400);
 assert.equal(db.prepare('SELECT count(*) AS n FROM asaas_coupon_uses').get().n,before);
});
test('checkout Asaas valida plano, termos e cupom no servidor antes da contratação',async()=>{
  const e=globalThis.__socialEnv;
  e.ASAAS_API_KEY='sandbox-test-key';
  e.ASAAS_MODE='sandbox';
  e.ASAAS_WEBHOOK_TOKEN='a'.repeat(48);
  e.ASAAS_WEBHOOK_READY='true';
  e.ASAAS_BILLING_ENABLED='true';
  db.prepare("INSERT INTO service_settings(key,value) VALUES ('legal',?)").run(JSON.stringify({name:'Operador de teste',taxId:'00000000000',address:'Endereço de teste',email:'owner@test.example'}));
  db.prepare("UPDATE discount_codes SET plan='plus' WHERE code='DESCONTO10'").run();
  const original=globalThis.fetch;
  let subscriptionRequest;
  globalThis.fetch=async(url,init)=>{
    const path=String(url);
    if(path.includes('/customers?'))return Response.json({data:[]});
    if(path.endsWith('/customers'))return Response.json({id:'cus_test'});
    if(path.endsWith('/subscriptions')&&init?.method==='POST'){
      subscriptionRequest=JSON.parse(init.body);
      return Response.json({id:'sub_test'});
    }
    if(path.includes('/subscriptions/sub_test/payments'))return Response.json({data:[{invoiceUrl:'https://sandbox.asaas.com/i/test',status:'PENDING'}]});
    throw Error('Network denied in test: '+path);
  };
  const payer={name:'Bob Teste',cpfCnpj:'52998224725'};
  try{
    who('bob');
    assert.equal((await request('checkout',{...payer,price:'__proto__',acceptTerms:true})).status,400);
    assert.equal((await request('checkout',{...payer,price:'plus_month'})).status,400);
    assert.equal((await request('checkout',{...payer,cpfCnpj:'00000000000',price:'plus_month',acceptTerms:true})).status,400);
    assert.equal((await request('checkout',{...payer,price:'pro_month',acceptTerms:true,discountCode:'DESCONTO10'})).status,400);
    const response=await request('checkout',{...payer,price:'plus_month',acceptTerms:true,discountCode:'DESCONTO10'});
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.url,'https://sandbox.asaas.com/i/test');
    assert.equal(subscriptionRequest.value,17.91);
    assert.equal(subscriptionRequest.cycle,'MONTHLY');
    assert.equal(subscriptionRequest.billingType,'UNDEFINED');
    assert.equal(db.prepare('SELECT count(*) AS n FROM asaas_coupon_uses').get().n,1);
  }finally{globalThis.fetch=original;e.ASAAS_BILLING_ENABLED='false';}
});
test('Asaas webhook autenticado libera Plus uma vez e revoga cobrança estornada',async()=>{
  const e=globalThis.__socialEnv;
  e.ASAAS_BILLING_ENABLED='true';
  const prevFetch=globalThis.fetch;
  let status='RECEIVED',updates=0;
  globalThis.fetch=async(url,init)=>{
    const path=String(url);
    if(path.includes('/payments/pay_test'))return Response.json({id:'pay_test',customer:'cus_test',subscription:'sub_test',billingType:'UNDEFINED',value:17.91,dueDate:new Date().toISOString().slice(0,10),status});
    if(path.includes('/subscriptions/sub_test')&&init?.method==='PUT'){updates++;return Response.json({id:'sub_test'});}
    throw Error('Unexpected Asaas request '+path);
  };
  const send=(id,token)=>api.webhook.POST(new Request('https://test.example/api/billing/webhook/asaas',{method:'POST',headers:{'Content-Type':'application/json',...(token?{'asaas-access-token':token}:{})},body:JSON.stringify({id,event:'PAYMENT_RECEIVED',payment:{id:'pay_test'}})}));
  try{
    assert.equal((await send('evt_payment_test',null)).status,401);
    assert.equal((await send('evt_payment_test','a'.repeat(48))).status,200);
    assert.equal((await send('evt_payment_test','a'.repeat(48))).status,200);
    assert.equal(updates,1);
    assert.equal(db.prepare('SELECT plan FROM subscriptions WHERE user_id=?').get('bob').plan,'plus');
    assert.equal(db.prepare('SELECT count(*) AS n FROM asaas_webhook_events').get().n,1);
    status='REFUNDED';
    assert.equal((await send('evt_refund_test','a'.repeat(48))).status,200);
    assert.equal(db.prepare('SELECT status FROM subscriptions WHERE user_id=?').get('bob').status,'canceled');
  }finally{globalThis.fetch=prevFetch;e.ASAAS_BILLING_ENABLED='false';}
});
test('exportação e exclusão autenticada não afetam outra conta',async()=>{who('bob');const exportData=await(await api.privacy.GET()).json();assert(!JSON.stringify(exportData).includes('MEUS_GASTOS_PRIVADOS'));assert.equal((await request('privacy',{confirm:'errado'},'DELETE')).status,400);assert.equal((await request('privacy',{confirm:'EXCLUIR MEUS DADOS'},'DELETE')).status,200);assert.equal(objects.size,0);assert(db.prepare('SELECT payload FROM accounts WHERE user_id=?').get('alice'));assert.equal(db.prepare('SELECT id FROM profiles WHERE user_id=?').get('bob'),undefined);});
test('encerramento exige confirmação e cancelamento prévio da assinatura',async()=>{who('closing');assert.equal((await request('profile',profile('closing','Encerramento'),'PUT')).status,200);db.prepare('INSERT INTO subscriptions(user_id,subscription_id,plan,status,updated_at,valid_until) VALUES (?,?,?,?,?,?)').run('closing','sub_closing','plus','active',1,Math.floor(Date.now()/1000)+86400);assert.equal((await request('privacy',{confirm:'EXCLUIR MEUS DADOS',closeAccount:true},'DELETE')).status,409);assert(db.prepare('SELECT id FROM profiles WHERE user_id=?').get('closing'));db.prepare('UPDATE subscriptions SET status=? WHERE user_id=?').run('canceled','closing');assert.equal((await request('privacy',{confirm:'EXCLUIR MEUS DADOS',closeAccount:true},'DELETE')).status,503);globalThis.__socialEnv.SUPABASE_SERVICE_ROLE_KEY='test-service-role';globalThis.__socialEnv.SUPABASE_URL='https://auth.test';const originalFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({});assert.equal((await request('privacy',{confirm:'EXCLUIR MEUS DADOS',closeAccount:true},'DELETE')).status,200);assert(db.prepare('SELECT user_id FROM closed_accounts WHERE user_id=?').get('closing'));assert.equal(db.prepare('SELECT id FROM profiles WHERE user_id=?').get('closing'),undefined);assert.equal((await request('profile',profile('closing','Encerramento'),'PUT')).status,403);globalThis.fetch=originalFetch;});
after(async()=>{db.close();await rm(dir,{recursive:true,force:true})});
