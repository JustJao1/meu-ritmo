import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const dir=await mkdtemp(join(tmpdir(),'mr-hosted-pix-confirm-'));
const db=new DatabaseSync(':memory:');
for(const file of (await readdir('drizzle')).filter(name=>name.endsWith('.sql')).sort())
 db.exec(await readFile('drizzle/'+file,'utf8'));
function prep(sql){
 const stmt=db.prepare(sql);
 return {bind(...args){return{
  async first(){return stmt.get(...args)||null},
  async all(){return {results:stmt.all(...args)}},
  async run(){const x=stmt.run(...args);return {meta:{changes:x.changes}}},
  execute(){const x=stmt.run(...args);return {meta:{changes:x.changes}}}
 }}};
}
const id='11111111-2222-4333-8444-555555555555';
const order='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const cust='cus_123456789';
const paymentId='pay_test_hosted_123';
const now=Math.floor(Date.now()/1000);
db.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES(?,?,?,?,?,'pending',?)").run(order,'payer','plus_month',1990,1990,now);
db.prepare("INSERT INTO asaas_hosted_pix_checkouts(order_id,checkout_id,customer_id,status,created_at,updated_at) VALUES (?,?,?,'ACTIVE',?,?)").run(order,id,cust,now,now);
let paymentStatus='PENDING',paymentCustomer=cust,paymentValue=19.9,paymentType='PIX',remoteCheckout=id;
const getPayment=()=>({
 id:paymentId,customer:paymentCustomer,checkoutSession:remoteCheckout,
 billingType:paymentType,value:paymentValue,status:paymentStatus,
 dueDate:new Date().toISOString().slice(0,10),paymentDate:new Date().toISOString().slice(0,10)
});
const paths=[];
globalThis.__hostedPixEnv={DB:{prepare:prep,async batch(statements){
 db.exec('BEGIN IMMEDIATE');
 try{const r=statements.map(q=>q.execute());db.exec('COMMIT');return r;}
 catch(error){db.exec('ROLLBACK');throw error;}
}}};
globalThis.__hostedPixAsaas=async path=>{
 paths.push(path);
 if(path.startsWith('/payments?checkoutSession='))return {data:[getPayment()]};
 if(path==='/payments/'+paymentId)return getPayment();
 throw Error('Unexpected Asaas endpoint '+path);
};
const plugins=[{name:'pix-module-mock',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cf',namespace:'pix-mock'}));
 b.onResolve({filter:/^\.\/asaas$/},()=>({path:'asaas',namespace:'pix-mock'}));
 b.onLoad({filter:/.*/,namespace:'pix-mock'},({path})=>({
  loader:'js',contents:path==='cf'?
    'export const env=globalThis.__hostedPixEnv;':
    'export const asaasRequest=(path)=>globalThis.__hostedPixAsaas(path);'
 }))
}}];
await build({entryPoints:['lib/asaas-hosted-pix-settlement.ts'],outfile:join(dir,'settlement.mjs'),
 bundle:true,format:'esm',platform:'node',plugins});
const {
 reconcileHostedPix,hostedPixCheckoutEvent,hostedPixPaymentEvent,
 getHostedPixForUser
}=await import(join(dir,'settlement.mjs'));
const row=()=>getHostedPixForUser('payer');
test('the payer has no access before a verified Pix payment',async()=>{
 const result=await reconcileHostedPix(await row());
 assert.equal(result.state,'pending');
 assert.equal(db.prepare("SELECT count(*) n FROM subscriptions WHERE user_id='payer'").get().n,0);
});
test('wrong customer, amount, type, checkout and status never grant paid access',async()=>{
 for(const [key,value] of [['paymentCustomer','cus_wrong_1'],['paymentValue',20.9],
 ['paymentType','CREDIT_CARD'],['remoteCheckout','11111111-1111-4111-8111-111111111111']]){
  if(key==='paymentCustomer')paymentCustomer=value;
  if(key==='paymentValue')paymentValue=value;
  if(key==='paymentType')paymentType=value;
  if(key==='remoteCheckout')remoteCheckout=value;
  paymentStatus='RECEIVED';
  assert.equal((await reconcileHostedPix(await row())).state,'pending',key);
  assert.equal(db.prepare("SELECT count(*) n FROM subscriptions WHERE user_id='payer'").get().n,0);
  paymentCustomer=cust;paymentValue=19.9;paymentType='PIX';remoteCheckout=id;
 }
 paymentStatus='PENDING';
 assert.equal((await reconcileHostedPix(await row())).state,'pending');
});
test('authenticated checkout PAID event still needs verified payment status',async()=>{
 paymentStatus='PENDING';
 const event={id:'evt_hosted_pending',event:'CHECKOUT_PAID',checkout:{
  id,status:'PAID',customer:cust,externalReference:order,
  billingTypes:['PIX'],chargeTypes:['DETACHED']
 }};
 const accepted=await hostedPixCheckoutEvent(event);
 assert.equal(accepted.status,200);
 assert.equal(db.prepare("SELECT count(*) n FROM subscriptions WHERE user_id='payer'").get().n,0);
 assert.equal(db.prepare("SELECT status FROM asaas_hosted_pix_checkouts WHERE order_id=?").get(order).status,'PAID');
});
test('cancelamento autenticado de Pix devolve o cupom sem liberar plano',async()=>{
 const checkout='22222222-3333-4444-8555-666666666666';
 const cancelOrder='bbbbbbbb-cccc-4ddd-8eee-eeeeeeeeeeee';
 const cancelCustomer='cus_cancel_123456';
 const codeId='dddddddd-eeee-4fff-8aaa-123456789000';
 db.prepare("INSERT INTO discount_codes(id,code,label,plan,kind,value,expires_at,max_uses,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
  .run(codeId,'TESTE-CANCEL','Cupom teste','plus','percent',10,now+86400,1,now);
 db.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES(?,?,?,?,?,'pending',?)")
  .run(cancelOrder,'cancel-payer','plus_month',1990,1791,now);
 db.prepare("INSERT INTO asaas_hosted_pix_checkouts(order_id,checkout_id,customer_id,status,created_at,updated_at) VALUES (?,?,?,'ACTIVE',?,?)")
  .run(cancelOrder,checkout,cancelCustomer,now,now);
 db.prepare("INSERT INTO asaas_coupon_uses(coupon_id,user_id,order_id,used_at) VALUES(?,?,?,?)")
  .run(codeId,'cancel-payer',cancelOrder,now);
 const response=await hostedPixCheckoutEvent({
  id:'evt_hosted_cancel_coupon',event:'CHECKOUT_CANCELED',
  checkout:{id:checkout,status:'CANCELED',customer:cancelCustomer,
   externalReference:cancelOrder,billingTypes:['PIX'],chargeTypes:['DETACHED']}
 });
 assert.equal(response.status,200);
 assert.equal(db.prepare('SELECT status FROM asaas_orders WHERE id=?').get(cancelOrder).status,'cancelled');
 assert.equal(db.prepare('SELECT count(*) n FROM asaas_coupon_uses WHERE order_id=?').get(cancelOrder).n,0);
 assert.equal(db.prepare("SELECT count(*) n FROM subscriptions WHERE user_id='cancel-payer'").get().n,0);
});

test('confirmed provider payment activates correct plan exactly once',async()=>{
 paymentStatus='RECEIVED';
 const first=await reconcileHostedPix(await row());
 assert.equal(first.state,'paid');
 assert.ok(first.validUntil>now);
 const paid=db.prepare("SELECT plan,status,valid_until,subscription_id FROM subscriptions WHERE user_id='payer'").get();
 assert.equal(paid.plan,'plus');assert.equal(paid.status,'active');
 assert.equal(paid.subscription_id,'checkout_'+id);
 assert.equal(db.prepare("SELECT count(*) n FROM asaas_payments WHERE order_id=?").get(order).n,1);
 assert.equal((await reconcileHostedPix(await row())).state,'paid');
 assert.equal(db.prepare("SELECT count(*) n FROM asaas_payments WHERE order_id=?").get(order).n,1);
});
test('confirmed payment webhook cannot add another paid period by replaying event',async()=>{
 const result=await hostedPixPaymentEvent({id:'evt_hosted_receive',event:'PAYMENT_RECEIVED'},getPayment());
 assert.equal(result.status,200);
 assert.equal(db.prepare("SELECT count(*) n FROM asaas_webhook_events WHERE event_id='evt_hosted_receive'").get().n,1);
});
test('verified refund removes remaining access without affecting other users',async()=>{
 paymentStatus='REFUNDED';
 const response=await hostedPixPaymentEvent({id:'evt_hosted_refund',event:'PAYMENT_REFUNDED'},getPayment());
 assert.equal(response.status,200);
 const s=db.prepare("SELECT status,valid_until FROM subscriptions WHERE user_id='payer'").get();
 assert.equal(s.status,'canceled');assert.ok(s.valid_until<=Math.floor(Date.now()/1000));
 assert.equal(db.prepare("SELECT status FROM asaas_orders WHERE id=?").get(order).status,'review');
});
after(async()=>{db.close();await rm(dir,{recursive:true,force:true});
 delete globalThis.__hostedPixEnv;delete globalThis.__hostedPixAsaas;});
