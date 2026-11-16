import {test,after} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {build} from 'esbuild';import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {deflateSync} from 'node:zlib';
const dir=await mkdtemp(join(tmpdir(),'ritmo-social-')),db=new DatabaseSync(':memory:');for(const f of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+f,'utf8'));
function prep(sql){const st=db.prepare(sql);let args=[];return {bind(...a){args=a;return this},async first(){return st.get(...args)||null},async all(){return {results:st.all(...args)}},async run(){return this.execute()},execute(){const r=st.run(...args);return {meta:{changes:r.changes}}}}}const objects=new Map();globalThis.__socialEnv={ADMIN_OWNER_EMAIL:'owner@test.example',ADMIN_OWNER_USER_ID:'owner',DB:{prepare:prep,async batch(s){db.exec('BEGIN IMMEDIATE');try{const r=s.map(x=>x.execute());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}},BUCKET:{async put(k,b,o){objects.set(k,{body:b,httpMetadata:o?.httpMetadata})},async get(k){return objects.get(k)||null},async delete(k){objects.delete(k)}}};
const plugin={name:'identity',setup(b){b.onResolve({filter:/session$/},()=>({path:'auth',namespace:'test'}));b.onResolve({filter:/avatar-store$/},()=>({path:'storage',namespace:'test'}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},({path})=>({contents:path==='storage'?'export const avatarStore=globalThis.__socialEnv.BUCKET;':path==='auth'?'export async function getUser(){return globalThis.__socialUser}':'export const env=globalThis.__socialEnv'}));}};const api={};for(const [name,path]of Object.entries({profile:'app/api/profile/route.ts',social:'app/api/social/route.ts',avatar:'app/api/avatar/route.ts',discount:'app/api/admin/discounts/route.ts',checkout:'app/api/billing/checkout/route.ts',quote:'app/api/billing/quote/route.ts',portal:'app/api/billing/portal/route.ts',cancel:'app/api/billing/cancel/route.ts',webhook:'app/api/billing/webhook/asaas/route.ts',account:'app/api/account/route.ts',privacy:'app/api/privacy/route.ts'})){await build({entryPoints:[path],outfile:join(dir,name+'.mjs'),bundle:true,platform:'node',format:'esm',plugins:[plugin]});api[name]=await import(join(dir,name+'.mjs'))}
const who=(id)=>globalThis.__socialUser=id?{userId:id,email:id+'@test.example',displayName:id,fullName:id}:null;const request=(name,body,method='POST',origin='https://test.example')=>api[name][method](new Request('https://test.example/api/'+name,{method,headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));const feed=(q='')=>api.social.GET(new Request('https://test.example/api/social'+q));const profile=(username,name)=>({username,name,bio:'Sobre a rotina',accept:true,adult:true});let postId;
for(const id of ['owner','alice','bob']){who(id);await api.account.GET()}
test('perfil exige identidade, aceite, maioridade declarada e nomes únicos',async()=>{who(null);assert.equal((await request('profile',profile('alice','Alice'),'PUT')).status,401);who('alice');assert.equal((await request('profile',{...profile('alice','Alice'),adult:false},'PUT')).status,400);assert.equal((await request('profile',profile('alice','Alice'),'PUT')).status,200);who('bob');assert.equal((await request('profile',profile('alice','Bob'),'PUT')).status,409);assert.equal((await request('profile',profile('bobrotina','Bob'),'PUT')).status,200);});
test('nome de usuário respeita 30 dias e exibição 14; bio não reinicia o prazo',async()=>{who('alice');assert.equal((await request('profile',profile('alice_novo','Alice'),'PUT')).status,409);assert.equal((await request('profile',profile('alice','Alice nova'),'PUT')).status,409);const before=db.prepare('SELECT username_changed_at,name_changed_at FROM profiles WHERE user_id=?').get('alice');assert.equal((await request('profile',{...profile('alice','Alice'),bio:'Outra bio'},'PUT')).status,200);assert.deepEqual(db.prepare('SELECT username_changed_at,name_changed_at FROM profiles WHERE user_id=?').get('alice'),before);db.prepare('UPDATE profiles SET username_changed_at=?,name_changed_at=? WHERE user_id=?').run(Math.floor(Date.now()/1000)-31*86400,Math.floor(Date.now()/1000)-15*86400,'alice');assert.equal((await request('profile',profile('alice_novo','Alice nova'),'PUT')).status,200);});
test('publicações só compartilham modelo confirmado e não incluem dados privados',async()=>{who('alice');db.prepare('INSERT INTO accounts(user_id,payload,revision) VALUES (?,?,?)').run('alice',JSON.stringify({segredo:'MEUS_GASTOS_PRIVADOS'}),1);const body={action:'post',category:'rotinas',title:'Manhã organizada',body:'Um modelo para adaptar',template:[{title:'Revisar agenda',time:'08:00'}]};assert.equal((await request('social',{...body,shareConfirmed:true})).status,403,'Free account cannot publish a routine even through the API');db.prepare("INSERT INTO subscriptions(user_id,subscription_id,plan,status,updated_at,valid_until) VALUES (?,?,?,?,?,?)").run('alice','sub_alice_pro','pro','active',Math.floor(Date.now()/1000),Math.floor(Date.now()/1000)+86400);assert.equal((await request('social',body)).status,400,'Pro publisher must confirm public sharing');assert.equal((await request('social',{...body,shareConfirmed:true,category:'conversas'})).status,400,'Template cannot be hidden in other categories');const r=await request('social',{...body,shareConfirmed:true});assert.equal(r.status,200);postId=(await r.json()).id;db.prepare("DELETE FROM subscriptions WHERE user_id='alice' AND subscription_id='sub_alice_pro'").run();who('bob');const f=await(await feed()).json();assert.equal(f.posts.length,1);assert.equal(f.posts[0].template[0].title,'Revisar agenda');assert(!JSON.stringify(f).includes('MEUS_GASTOS_PRIVADOS'));assert(!JSON.stringify(f).includes('alice@test.example'));assert.equal((await request('social',{action:'remove',postId})).status,403);});
test('respostas, bloqueio bilateral e denúncias respeitam permissões',async()=>{who('bob');assert.equal((await request('social',{action:'comment',postId,body:'Obrigado pelo modelo'})).status,200);const alice=db.prepare('SELECT id FROM profiles WHERE user_id=?').get('alice');assert.equal((await request('social',{action:'block',profileId:alice.id,enabled:true})).status,200);assert.equal((await(await feed()).json()).posts.length,0);who('alice');assert.equal((await(await feed()).json()).posts[0].username,'alice_novo');who('bob');await request('social',{action:'block',profileId:alice.id,enabled:false});assert.equal((await request('social',{action:'report',postId,reason:'Verificar publicação de teste'})).status,200);assert.equal((await feed('?moderation=1')).status,403);who('owner');assert.equal((await(await feed('?moderation=1')).json()).reports.length,1);assert.equal((await request('social',{action:'suspend',profileId:alice.id,enabled:true})).status,200);who('alice');assert.equal((await request('social',{action:'post',category:'conversas',title:'Tentativa',body:'Perfil suspenso'})).status,403);who('owner');await request('social',{action:'suspend',profileId:alice.id,enabled:false});});
function png(){const crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0};const chunk=(type,data)=>{const b=Buffer.concat([Buffer.from(type),data]),n=Buffer.alloc(4),c=Buffer.alloc(4);n.writeUInt32BE(data.length);c.writeUInt32BE(crc(b));return Buffer.concat([n,b,c])};const h=Buffer.from([0,0,0,1,0,0,0,1,8,6,0,0,0]);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('tEXt',Buffer.from('private\0SECRET_METADATA')),chunk('IDAT',deflateSync(Buffer.from([0,255,0,0,255]))),chunk('IEND',Buffer.alloc(0))])}
test('free and Plus members can read and copy a published routine, but only Pro can publish one',async()=>{who('bob');const routine={action:'post',category:'rotinas',title:'Minha rotina',body:'Modelo de treino',template:[{title:'Caminhar',time:'07:30'}],shareConfirmed:true};assert.equal((await request('social',routine)).status,403);assert.equal((await request('social',{...routine,category:'conversas'})).status,403,'Template in another category cannot bypass the Pro restriction');const shared=(await(await feed()).json()).posts.find(p=>p.category==='rotinas');assert(shared&&shared.template[0].title==='Revisar agenda','Free users can still view routines and copy them into their own plan');const now=Math.floor(Date.now()/1000);db.prepare("INSERT INTO subscriptions(user_id,subscription_id,plan,status,updated_at,valid_until) VALUES (?,?,?,?,?,?)").run('bob','sub_bob_plus','plus','active',now,now+86400);assert.equal((await request('social',routine)).status,403,'Plus also cannot publish a routine');assert.equal((await request('social',{action:'post',category:'conversas',title:'Dúvida de rotina',body:'Como vocês organizam o dia?'})).status,200,'Ordinary posts remain available');db.prepare("UPDATE subscriptions SET status='canceled' WHERE user_id='bob'").run();});
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
  db.prepare("INSERT INTO service_settings(key,value) VALUES ('legal',?)").run(JSON.stringify({name:'Operador de teste',taxId:'529.982.247-25',address:'Rua Teste, 100, São Paulo',email:'owner@test.example'}));
  db.prepare("UPDATE discount_codes SET plan='plus' WHERE code='DESCONTO10'").run();
  const original=globalThis.fetch;
  let subscriptionRequest;
  let customerCount=0, subscriptionCount=0;
  globalThis.fetch=async(url,init)=>{
    const path=String(url);
    if(path.includes('/customers?'))return Response.json({data:[]});
    if(path.endsWith('/customers'))return Response.json({id:customerCount++===0?'cus_test':'cus_test_2'});
    if(path.endsWith('/subscriptions')&&init?.method==='POST'){
      subscriptionRequest=JSON.parse(init.body);
      return Response.json({id:subscriptionCount++===0?'sub_0_test':'sub_0_test_2'});
    }
    if(path.includes('/subscriptions/sub_0_test/payments')||path.includes('/subscriptions/sub_0_test_2/payments'))return Response.json({data:[{invoiceUrl:'https://sandbox.asaas.com/i/test',billingType:'PIX',status:'PENDING'}]});
    throw Error('Network denied in test: '+path);
  };
  const payer={name:'Bob Teste',cpfCnpj:'52998224725'};
  try{
    who('bob');
    assert.equal((await request('checkout',{...payer,price:'__proto__',acceptTerms:true})).status,400);
    assert.equal((await request('checkout',{...payer,price:'plus_month'})).status,400);
    assert.equal((await request('checkout',{...payer,cpfCnpj:'00000000000',price:'plus_month',acceptTerms:true})).status,400);
    assert.equal((await request('checkout',{...payer,price:'pro_month',acceptTerms:true,acceptRefundPolicy:true,discountCode:'DESCONTO10'})).status,400);
    for(const paymentMethod of ['BOLETO','CREDIT_CARD','UNDEFINED','bolet','']) {
      const invalid=await request('checkout',{...payer,price:'plus_month',acceptTerms:true,acceptRefundPolicy:true,paymentMethod});
      assert.equal(invalid.status,400,'Banned checkout method '+paymentMethod);
    }
    assert.equal((await request('checkout',{...payer,price:'plus_month',acceptTerms:true,acceptRefundPolicy:true})).status,400,'Payment method must be explicitly selected');
    assert.equal((await request('checkout',{...payer,price:'plus_month',paymentMethod:'PIX',acceptTerms:true,discountCode:'DESCONTO10'})).status,400,'Refund policy must be accepted explicitly');
    const response=await request('checkout',{...payer,price:'plus_month',paymentMethod:'PIX',acceptTerms:true,acceptRefundPolicy:true,discountCode:'DESCONTO10'});
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.url,'https://sandbox.asaas.com/i/test');
    assert.equal(subscriptionRequest.value,17.91);
    assert.equal(subscriptionRequest.cycle,'MONTHLY');
    assert.equal(subscriptionRequest.billingType,'PIX');
    assert.equal(db.prepare('SELECT count(*) AS n FROM asaas_coupon_uses').get().n,1);
    who('alice');
    e.ASAAS_CARD_CHECKOUT_ENABLED='true';
    const blockedCard=await request('checkout',{...payer,price:'pro_month',paymentMethod:'CREDIT_CARD',acceptTerms:true,acceptRefundPolicy:true});
    assert.equal(blockedCard.status,400,'Cartão deve ser recusado mesmo se a flag estiver ativada');
  }finally{globalThis.fetch=original;e.ASAAS_BILLING_ENABLED='false';e.ASAAS_CARD_CHECKOUT_ENABLED='false';}
});
test('Checkout de cartão vincula assinatura ao pedido e só libera Pro após pagamento confirmado',async()=>{
 const e=globalThis.__socialEnv,prevFetch=globalThis.fetch;
 const checkoutId='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
 // Historical card checkouts must still process refunds and late webhooks,
 // even though new card purchases are disabled.
 const historicalOrder='12121212-1212-4212-8212-121212121212',now=Math.floor(Date.now()/1000);
 db.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES (?,?,?,?,?,?,?)")
  .run(historicalOrder,'alice','pro_month',2990,2990,'pending',now);
 db.prepare("INSERT INTO asaas_card_checkouts(order_id,checkout_id,customer_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)")
  .run(historicalOrder,checkoutId,'','ACTIVE',now,now);
 const card=db.prepare('SELECT c.order_id,c.customer_id FROM asaas_card_checkouts c WHERE c.checkout_id=?').get(checkoutId);
 assert(card&&card.customer_id==='','Checkout histórico sem pagador permanece seguro');
 const subscription='sub_card_alice',paymentId='pay_card_alice',payerId='cus_test_2';
 let paymentStatus='PENDING';
 globalThis.fetch=async url=>{
  const link=String(url);
  if(link.includes('/payments?checkoutSession='+checkoutId))return Response.json({data:[{id:paymentId,customer:payerId,subscription,billingType:'CREDIT_CARD',value:29.9}]});
  if(link.endsWith('/subscriptions/'+subscription))return Response.json({
    id:subscription,customer:payerId,billingType:'CREDIT_CARD',
    value:29.9,cycle:'MONTHLY',externalReference:null,status:'ACTIVE',deleted:false
  });
  if(link.endsWith('/payments/'+paymentId))return Response.json({
    id:paymentId,customer:payerId,subscription,billingType:'CREDIT_CARD',
    value:29.9,dueDate:new Date(Date.now()+86400000).toISOString().slice(0,10),status:paymentStatus
  });
  throw Error('Unexpected card provider call: '+link);
 };
 const notify=(id,event,payload={})=>api.webhook.POST(new Request('https://test.example/api/billing/webhook/asaas',{
  method:'POST',headers:{'asaas-access-token':'a'.repeat(48),'Content-Type':'application/json'},
  body:JSON.stringify({id,event,...payload})
 }));
 const checkout=(customer,status)=>({checkout:{id:checkoutId,customer,status,billingTypes:['CREDIT_CARD'],chargeTypes:['RECURRENT']}});
 try{
  assert.equal((await notify('evt_card_checkout_created','CHECKOUT_CREATED',checkout(null,'ACTIVE'))).status,200);
  assert.equal((await notify('evt_card_checkout_unbound','CHECKOUT_PAID',checkout('invalid','PAID'))).status,409);
  assert.equal(db.prepare('SELECT status FROM asaas_card_checkouts WHERE checkout_id=?').get(checkoutId).status,'ACTIVE');
  assert.equal((await notify('evt_card_checkout_paid','CHECKOUT_PAID',checkout(payerId,'PAID'))).status,200);
  assert.equal(db.prepare('SELECT customer_id FROM asaas_card_checkouts WHERE checkout_id=?').get(checkoutId).customer_id,payerId);
  assert.equal(db.prepare('SELECT status FROM asaas_card_checkouts WHERE checkout_id=?').get(checkoutId).status,'PAID');
  assert.equal(db.prepare("SELECT * FROM subscriptions WHERE user_id='alice'").get(),undefined,'Checkout redirect/event must not grant Pro');
  assert.equal((await notify('evt_card_subscription','SUBSCRIPTION_CREATED',{subscription:{id:subscription}})).status,200);
  assert.equal(db.prepare('SELECT provider_subscription_id FROM asaas_orders WHERE id=?').get(card.order_id).provider_subscription_id,subscription);
  assert.equal(db.prepare("SELECT * FROM subscriptions WHERE user_id='alice'").get(),undefined,'Subscription creation must not grant Pro');
  assert.equal((await notify('evt_card_pending','PAYMENT_UPDATED',{payment:{id:paymentId}})).status,200);
  assert.equal(db.prepare("SELECT * FROM subscriptions WHERE user_id='alice'").get(),undefined,'Pending card invoice must not grant Pro');
  paymentStatus='RECEIVED';
  assert.equal((await notify('evt_card_declined','PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',{payment:{id:paymentId}})).status,200);
  assert.equal(db.prepare("SELECT * FROM subscriptions WHERE user_id='alice'").get(),undefined,'A refusal event must not grant Pro, even if provider reports a stale confirmed status');
  assert.equal((await notify('evt_card_risk_refused','PAYMENT_REPROVED_BY_RISK_ANALYSIS',{payment:{id:paymentId}})).status,200);
  assert.equal(db.prepare("SELECT * FROM subscriptions WHERE user_id='alice'").get(),undefined,'Risk refusal must not grant Pro, even if provider reports a stale confirmed status');
  assert.equal((await notify('evt_card_paid','PAYMENT_RECEIVED',{payment:{id:paymentId}})).status,200);
  assert.equal((await notify('evt_card_paid','PAYMENT_RECEIVED',{payment:{id:paymentId}})).status,200,'Repeat event is idempotent');
  const active=db.prepare("SELECT plan,status,valid_until FROM subscriptions WHERE user_id='alice'").get();
  assert.equal(active.plan,'pro');assert.equal(active.status,'active');assert(active.valid_until>Math.floor(Date.now()/1000));
  paymentStatus='REFUNDED';
  assert.equal((await notify('evt_card_refund','PAYMENT_REFUNDED',{payment:{id:paymentId}})).status,200);
  assert.equal(db.prepare("SELECT status FROM subscriptions WHERE user_id='alice'").get().status,'canceled');
 }finally{globalThis.fetch=prevFetch;e.ASAAS_BILLING_ENABLED='false';}
});
test('Cartão com eventos fora de ordem e entrega 4 dias atrasada só ativa após cobrança confirmada',async()=>{
 const now=Math.floor(Date.now()/1000);
 const order='77777777-7777-4777-8777-777777777777';
 const checkoutId='88888888-8888-4888-8888-888888888888';
 const payerId='cus_outoforder';
 const subscriptionId='sub_card_outoforder',paymentId='pay_card_outoforder';
 db.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES (?,?,?,?,?,?,?)")
  .run(order,'recurring-user','plus_year',19990,19990,'pending',now);
 db.prepare("INSERT INTO asaas_card_checkouts(order_id,checkout_id,customer_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)")
  .run(order,checkoutId,'','ACTIVE',now-4*86400,now-4*86400);
 let current='PENDING';
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{
  const id=String(url);
  if(id.includes('/payments?checkoutSession='+checkoutId))return Response.json({data:[{id:paymentId,customer:payerId,subscription:subscriptionId,billingType:'CREDIT_CARD',value:199.90}]});
  if(id.endsWith('/subscriptions/'+subscriptionId))
   return Response.json({id:subscriptionId,customer:payerId,billingType:'CREDIT_CARD',value:199.90,cycle:'YEARLY',status:'ACTIVE',externalReference:null});
  if(id.endsWith('/payments/'+paymentId))
   return Response.json({id:paymentId,customer:payerId,subscription:subscriptionId,billingType:'CREDIT_CARD',value:199.90,dueDate:new Date().toISOString().slice(0,10),status:current});
  throw Error('Unexpected Asaas request: '+id);
 };
 const send=(id,event,detail)=>api.webhook.POST(new Request('https://test.example/api/billing/webhook/asaas',{
  method:'POST',headers:{'asaas-access-token':'a'.repeat(48),'Content-Type':'application/json'},
  body:JSON.stringify({id,event,...detail})
 }));
 const paidCheckout={checkout:{id:checkoutId,customer:null,status:'PAID',billingTypes:['CREDIT_CARD'],chargeTypes:['RECURRENT']}};
 try{
  const subscriptionEvent=await send('evt_card_early_sub','SUBSCRIPTION_CREATED',{subscription:{id:subscriptionId}});
  assert.equal(subscriptionEvent.status,200);
  assert.equal(db.prepare('SELECT provider_subscription_id FROM asaas_orders WHERE id=?').get(order).provider_subscription_id,null);
  assert.equal((await send('evt_card_early_payment','PAYMENT_UPDATED',{payment:{id:paymentId}})).status,503,'Do not bind an unpaid Checkout');
  assert.equal(db.prepare("SELECT * FROM subscriptions WHERE user_id='recurring-user'").get(),undefined);
  assert.equal((await send('evt_card_real_checkout','CHECKOUT_PAID',paidCheckout)).status,200);
  assert.equal(db.prepare('SELECT customer_id FROM asaas_card_checkouts WHERE order_id=?').get(order).customer_id,'');
  assert.equal((await send('evt_card_late_payment','PAYMENT_UPDATED',{payment:{id:paymentId}})).status,200);
  assert.equal(db.prepare('SELECT customer_id FROM asaas_card_checkouts WHERE order_id=?').get(order).customer_id,payerId);
  assert.equal(db.prepare('SELECT provider_subscription_id FROM asaas_orders WHERE id=?').get(order).provider_subscription_id,subscriptionId);
  assert.equal(db.prepare("SELECT * FROM subscriptions WHERE user_id='recurring-user'").get(),undefined);
  current='CONFIRMED';
  assert.equal((await send('evt_card_approved','PAYMENT_CONFIRMED',{payment:{id:paymentId}})).status,200);
  const active=db.prepare("SELECT plan,status,valid_until FROM subscriptions WHERE user_id='recurring-user'").get();
  assert.equal(active.plan,'plus');assert.equal(active.status,'active');assert(active.valid_until>now+330*86400);
 }finally{globalThis.fetch=original;}
});
test('cancelar checkout hospedado pendente não gera cobrança nem libera acesso',async()=>{
 const now=Math.floor(Date.now()/1000),order='99999999-9999-4999-8999-999999999999',checkoutId='10101010-1010-4010-8010-101010101010';
 db.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES (?,?,?,?,?,?,?)")
  .run(order,'no-charge','plus_month',1990,1990,'pending',now);
 db.prepare("INSERT INTO asaas_card_checkouts(order_id,checkout_id,customer_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)")
  .run(order,checkoutId,'','ACTIVE',now,now);
 const original=globalThis.fetch;
 let cancellation=0;
 globalThis.fetch=async(url,init)=>{
  if(String(url).endsWith('/checkouts/'+checkoutId+'/cancel')&&init?.method==='POST'){
   cancellation++;return Response.json({id:checkoutId,status:'CANCELED'});
  }
  throw Error('Unexpected Asaas request: '+url);
 };
 try{
  who('no-charge');
  const result=await request('cancel',{});
  assert.equal(result.status,200);
  assert.match((await result.json()).message,/cancelado/);
  assert.equal(cancellation,1);
  assert.equal(db.prepare('SELECT status FROM asaas_card_checkouts WHERE order_id=?').get(order).status,'CANCELED');
  assert.equal(db.prepare('SELECT status FROM asaas_orders WHERE id=?').get(order).status,'cancelled');
  assert.equal(db.prepare("SELECT * FROM subscriptions WHERE user_id='no-charge'").get(),undefined);
 }finally{globalThis.fetch=original;}
});
test('checkout expirado pelo Asaas não libera plano nem aceita confirmação tardia de criação',async()=>{
 const now=Math.floor(Date.now()/1000),order='45454545-4545-4454-8454-454545454545';
 const checkoutId='67676767-6767-4676-8676-676767676767';
 db.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES (?,?,?,?,?,?,?)")
  .run(order,'expired-card-user','pro_month',2990,2990,'pending',now);
 db.prepare("INSERT INTO asaas_card_checkouts(order_id,checkout_id,customer_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)")
  .run(order,checkoutId,'','ACTIVE',now,now);
 const event=(id,type,status)=>api.webhook.POST(new Request('https://test.example/api/billing/webhook/asaas',{
  method:'POST',headers:{'asaas-access-token':'a'.repeat(48),'Content-Type':'application/json'},
  body:JSON.stringify({id,event:type,checkout:{id:checkoutId,status,customer:null,
   billingTypes:['CREDIT_CARD'],chargeTypes:['RECURRENT']}})
 }));
 assert.equal((await event('evt_card_expired_1','CHECKOUT_EXPIRED','EXPIRED')).status,200);
 assert.equal(db.prepare("SELECT status FROM asaas_card_checkouts WHERE order_id=?").get(order).status,'EXPIRED');
 assert.equal(db.prepare("SELECT status FROM asaas_orders WHERE id=?").get(order).status,'cancelled');
 assert.equal((await event('evt_card_expired_2','CHECKOUT_CREATED','ACTIVE')).status,200);
 assert.equal(db.prepare("SELECT * FROM subscriptions WHERE user_id='expired-card-user'").get(),undefined);
 assert.equal(db.prepare("SELECT status FROM asaas_orders WHERE id=?").get(order).status,'cancelled');
});

test('Asaas webhook autenticado libera Plus uma vez e revoga cobrança estornada',async()=>{
  const e=globalThis.__socialEnv;
  e.ASAAS_BILLING_ENABLED='true';
  const prevFetch=globalThis.fetch;
  let status='RECEIVED',updates=0;
  globalThis.fetch=async(url,init)=>{
    const path=String(url);
    if(path.includes('/payments/pay_0_test'))return Response.json({id:'pay_0_test',customer:'cus_test',subscription:'sub_0_test',billingType:'UNDEFINED',value:17.91,dueDate:new Date().toISOString().slice(0,10),status});
    if(path.includes('/subscriptions/sub_0_test')&&init?.method==='PUT'){updates++;return Response.json({id:'sub_0_test'});}
    throw Error('Unexpected Asaas request '+path);
  };
  const send=(id,token)=>api.webhook.POST(new Request('https://test.example/api/billing/webhook/asaas',{method:'POST',headers:{'Content-Type':'application/json',...(token?{'asaas-access-token':token}:{})},body:JSON.stringify({id,event:'PAYMENT_RECEIVED',payment:{id:'pay_0_test'}})}));
  try{
    assert.equal((await send('evt_payment_test',null)).status,401);
    assert.equal((await send('evt_payment_test','a'.repeat(48))).status,200);
    assert.equal((await send('evt_payment_test','a'.repeat(48))).status,200);
    assert.equal(updates,1);
    assert.equal(db.prepare('SELECT plan FROM subscriptions WHERE user_id=?').get('bob').plan,'plus');
    assert.equal(db.prepare("SELECT count(*) AS n FROM asaas_webhook_events WHERE event_id='evt_payment_test'").get().n,1);
    status='REFUNDED';
    assert.equal((await send('evt_refund_test','a'.repeat(48))).status,200);
    assert.equal(db.prepare('SELECT status FROM subscriptions WHERE user_id=?').get('bob').status,'canceled');
  }finally{globalThis.fetch=prevFetch;e.ASAAS_BILLING_ENABLED='false';}
});
test('webhook ainda concilia pagamentos existentes quando novas vendas foram pausadas',async()=>{
 const e=globalThis.__socialEnv;
 e.ASAAS_BILLING_ENABLED='false';
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{
   if(String(url).includes('/payments/pay_second'))
     return Response.json({id:'pay_second',customer:'cus_test',subscription:'sub_0_test',billingType:'PIX',value:19.90,dueDate:new Date().toISOString().slice(0,10),status:'RECEIVED'});
   throw Error('Unexpected Asaas request '+url);
 };
 try{
   const webhook=new Request('https://test.example/api/billing/webhook/asaas',{method:'POST',headers:{'Content-Type':'application/json','asaas-access-token':'a'.repeat(48)},body:JSON.stringify({id:'evt_second_payment',event:'PAYMENT_RECEIVED',payment:{id:'pay_second'}})});
   assert.equal((await api.webhook.POST(webhook)).status,200);
   assert.equal(db.prepare('SELECT status FROM asaas_payments WHERE payment_id=?').get('pay_second').status,'RECEIVED');
 }finally{globalThis.fetch=original;}
});

test('cancelamento antecipado não bloqueia acesso a uma fatura Pix efetivamente paga',async()=>{
 const now=Math.floor(Date.now()/1000);
 const coupon=db.prepare("SELECT id FROM discount_codes WHERE code='DESCONTO10'").get();
 assert(coupon?.id);
 db.prepare('INSERT INTO asaas_customers(user_id,customer_id,created_at) VALUES (?,?,?)').run('eve','cus_eve',now);
 db.prepare("INSERT INTO asaas_orders(id,user_id,provider_subscription_id,plan_code,base_price_cents,first_price_cents,coupon_id,coupon_code,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
  .run('order_eve','eve','sub_eve','plus_month',1990,1791,coupon.id,'DESCONTO10','pending',now);
 let changedValue=false;
 const original=globalThis.fetch;
 globalThis.fetch=async (url,init)=>{
  const address=String(url);
  if(address.endsWith('/subscriptions/sub_eve')&&init?.method==='DELETE')return Response.json({deleted:true});
  if(address.endsWith('/subscriptions/sub_eve')&&init?.method==='PUT'){changedValue=true;throw Error('Cancelled subscription must not be updated');}
  if(address.endsWith('/payments/pay_eve'))return Response.json({id:'pay_eve',customer:'cus_eve',subscription:'sub_eve',billingType:'PIX',value:17.91,dueDate:new Date().toISOString().slice(0,10),status:'RECEIVED'});
  throw Error('Unexpected provider call '+address);
 };
 try{
  who('eve');
  const canceled=await request('cancel',{});
  assert.equal(canceled.status,200);
  assert.match((await canceled.json()).message,/Nenhum acesso pago/);
  assert.equal(db.prepare("SELECT status FROM asaas_orders WHERE id='order_eve'").get().status,'cancelled');
  const event=new Request('https://test.example/api/billing/webhook/asaas',{method:'POST',headers:{'Content-Type':'application/json','asaas-access-token':'a'.repeat(48)},body:JSON.stringify({id:'evt_eve_paid',event:'PAYMENT_RECEIVED',payment:{id:'pay_eve'}})});
  assert.equal((await api.webhook.POST(event)).status,200);
  assert.equal(changedValue,false);
  assert.equal(db.prepare("SELECT status FROM asaas_orders WHERE id='order_eve'").get().status,'cancelled');
  const entitlement=db.prepare("SELECT plan,status,valid_until FROM subscriptions WHERE user_id='eve'").get();
  assert.equal(entitlement.plan,'plus');assert.equal(entitlement.status,'active');assert(entitlement.valid_until>now);
 }finally{globalThis.fetch=original;}
});

test('estorno da renovação não retira o período anterior pago, e estorno total revoga',async()=>{
 const now=Math.floor(Date.now()/1000),due=new Date().toISOString().slice(0,10),renewalDue=new Date(Date.now()+32*86400000).toISOString().slice(0,10);
 db.prepare('INSERT INTO asaas_customers(user_id,customer_id,created_at) VALUES (?,?,?)').run('cora','cus_cora',now);
 db.prepare("INSERT INTO asaas_orders(id,user_id,provider_subscription_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES (?,?,?,?,?,?,?,?)")
  .run('order_cora','cora','sub_cora','plus_month',1990,1990,'pending',now);
 const paymentStatuses=new Map([['pay_corafirst','RECEIVED'],['pay_corarenewal','RECEIVED']]);
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{
  const id=String(url).split('/').pop();
  if(paymentStatuses.has(id))return Response.json({id,customer:'cus_cora',subscription:'sub_cora',billingType:'PIX',value:19.90,dueDate:id==='pay_corafirst'?due:renewalDue,status:paymentStatuses.get(id)});
  throw Error('Unexpected provider call '+url);
 };
 let eventCount=0;
 const webhook=(paymentId)=>api.webhook.POST(new Request('https://test.example/api/billing/webhook/asaas',{method:'POST',headers:{'Content-Type':'application/json','asaas-access-token':'a'.repeat(48)},body:JSON.stringify({id:'evt_cora_'+(++eventCount),event:paymentStatuses.get(paymentId)==='RECEIVED'?'PAYMENT_RECEIVED':paymentStatuses.get(paymentId)==='PARTIALLY_REFUNDED'?'PAYMENT_PARTIALLY_REFUNDED':'PAYMENT_REFUNDED',payment:{id:paymentId}})}));
 try{
  assert.equal((await webhook('pay_corafirst')).status,200);
  const firstUntil=db.prepare("SELECT valid_until FROM subscriptions WHERE user_id='cora'").get().valid_until;
  assert(firstUntil>now);
  assert.equal((await webhook('pay_corarenewal')).status,200);
  assert(db.prepare("SELECT valid_until FROM subscriptions WHERE user_id='cora'").get().valid_until>firstUntil);
  paymentStatuses.set('pay_corarenewal','PARTIALLY_REFUNDED');
  assert.equal((await webhook('pay_corarenewal')).status,200);
  assert.equal(db.prepare("SELECT status FROM asaas_orders WHERE id='order_cora'").get().status,'review','Partial refunds require review');
  assert.equal(db.prepare("SELECT status FROM subscriptions WHERE user_id='cora'").get().status,'active');
  paymentStatuses.set('pay_corarenewal','REFUNDED');
  assert.equal((await webhook('pay_corarenewal')).status,200);
  const remaining=db.prepare("SELECT valid_until,status FROM subscriptions WHERE user_id='cora'").get();
  assert.equal(remaining.valid_until,firstUntil);
  assert.equal(remaining.status,'active');
  paymentStatuses.set('pay_corafirst','REFUNDED');
  assert.equal((await webhook('pay_corafirst')).status,200);
  const revoked=db.prepare("SELECT valid_until,status FROM subscriptions WHERE user_id='cora'").get();
  assert.equal(revoked.valid_until,0);
  assert.equal(revoked.status,'canceled');
 }finally{globalThis.fetch=original;}
});

test('pagamento atrasado de assinatura antiga não substitui plano mais recente',async()=>{
 const now=Math.floor(Date.now()/1000);
 db.prepare('INSERT INTO asaas_customers(user_id,customer_id,created_at) VALUES (?,?,?)').run('diana','cus_diana',now);
 db.prepare("INSERT INTO asaas_orders(id,user_id,provider_subscription_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES (?,?,?,?,?,?,?,?)")
  .run('order_diana_old','diana','sub_diana_old','plus_month',1990,1990,'cancelled',now-10000);
 db.prepare("INSERT INTO asaas_orders(id,user_id,provider_subscription_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES (?,?,?,?,?,?,?,?)")
  .run('order_diana_new','diana','sub_diana_new','pro_month',3990,3990,'active',now);
 const currentUntil=now+90*86400;
 db.prepare("INSERT INTO subscriptions(user_id,subscription_id,plan,status,updated_at,valid_until) VALUES (?,?,?,?,?,?)").run('diana','sub_diana_new','pro','active',now,currentUntil);
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{
  if(String(url).endsWith('/payments/pay_dianaold'))return Response.json({id:'pay_dianaold',customer:'cus_diana',subscription:'sub_diana_old',billingType:'PIX',value:19.90,dueDate:new Date().toISOString().slice(0,10),status:'RECEIVED'});
  throw Error('Unexpected provider call '+url);
 };
 try{
  const event=new Request('https://test.example/api/billing/webhook/asaas',{method:'POST',headers:{'Content-Type':'application/json','asaas-access-token':'a'.repeat(48)},body:JSON.stringify({id:'evt_diana_old',event:'PAYMENT_RECEIVED',payment:{id:'pay_dianaold'}})});
  assert.equal((await api.webhook.POST(event)).status,200);
  const saved=db.prepare("SELECT subscription_id,plan,status,valid_until FROM subscriptions WHERE user_id='diana'").get();
  assert.equal(saved.subscription_id,'sub_diana_new');assert.equal(saved.plan,'pro');assert.equal(saved.valid_until,currentUntil);
 }finally{globalThis.fetch=original;}
});

test('exportação e exclusão autenticada não afetam outra conta',async()=>{who('bob');const exportData=await(await api.privacy.GET()).json();assert(!JSON.stringify(exportData).includes('MEUS_GASTOS_PRIVADOS'));assert.equal((await request('privacy',{confirm:'errado'},'DELETE')).status,400);assert.equal((await request('privacy',{confirm:'EXCLUIR MEUS DADOS'},'DELETE')).status,200);assert.equal(objects.size,0);assert(db.prepare('SELECT payload FROM accounts WHERE user_id=?').get('alice'));assert.equal(db.prepare('SELECT id FROM profiles WHERE user_id=?').get('bob'),undefined);});
test('encerramento exige confirmação e cancelamento prévio da assinatura',async()=>{who('closing');assert.equal((await request('profile',profile('closing','Encerramento'),'PUT')).status,200);db.prepare('INSERT INTO subscriptions(user_id,subscription_id,plan,status,updated_at,valid_until) VALUES (?,?,?,?,?,?)').run('closing','sub_closing','plus','active',1,Math.floor(Date.now()/1000)+86400);assert.equal((await request('privacy',{confirm:'EXCLUIR MEUS DADOS',closeAccount:true},'DELETE')).status,409);assert(db.prepare('SELECT id FROM profiles WHERE user_id=?').get('closing'));db.prepare('UPDATE subscriptions SET status=? WHERE user_id=?').run('canceled','closing');assert.equal((await request('privacy',{confirm:'EXCLUIR MEUS DADOS',closeAccount:true},'DELETE')).status,503);globalThis.__socialEnv.SUPABASE_SERVICE_ROLE_KEY='test-service-role';globalThis.__socialEnv.SUPABASE_URL='https://auth.test';const originalFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({});assert.equal((await request('privacy',{confirm:'EXCLUIR MEUS DADOS',closeAccount:true},'DELETE')).status,200);assert(db.prepare('SELECT user_id FROM closed_accounts WHERE user_id=?').get('closing'));assert.equal(db.prepare('SELECT id FROM profiles WHERE user_id=?').get('closing'),undefined);assert.equal((await request('profile',profile('closing','Encerramento'),'PUT')).status,403);globalThis.fetch=originalFetch;});
after(async()=>{db.close();await rm(dir,{recursive:true,force:true})});
