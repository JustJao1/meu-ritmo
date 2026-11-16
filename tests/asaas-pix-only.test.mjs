import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const folder=await mkdtemp(join(tmpdir(),'mr-pix-only-'));
const orderId='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
let calls=[];
const state={
 user:{userId:'pix-user'},
 order:{id:orderId,provider_subscription_id:'sub_pix_test',status:'pending',
  first_price_cents:1990,base_price_cents:1990,first_paid_at:null},
 customer:{customer_id:'cus_pix_test'},
 payment:{id:'pay_pix_test',customer:'cus_pix_test',subscription:'sub_pix_test',
  billingType:'BOLETO',value:19.9,status:'PENDING',dueDate:'2026-11-16'},
 qrAvailable:true
};
globalThis.__testPix={
 state,getUser:async()=>state.user,
 env:{DB:{prepare(sql){return {bind(...values){return {async first(){if(sql.includes('FROM asaas_orders'))
    return values[1]==='pix-user'&&values[0]===orderId?state.order:null;
    if(sql.includes('FROM asaas_customers'))return state.customer;return null;}};}}}}},
 config:()=>({apiReady:true}),
 request:async(path,opts={})=>{
  calls.push({path,method:opts.method||'GET'});
  if(path==='/subscriptions/sub_pix_test')return {id:'sub_pix_test',customer:'cus_pix_test',billingType:'BOLETO',externalReference:orderId};
  if(path.includes('/subscriptions/sub_pix_test/payments'))return {data:[state.payment]};
  if(path==='/payments/pay_pix_test'&&opts.method==='PUT'){
   assert.equal(opts.body.billingType,'PIX');
   state.payment={...state.payment,billingType:'PIX'};
   return state.payment;
  }
  if(path==='/payments/pay_pix_test')return state.payment;
  if(path==='/payments/pay_pix_test/pixQrCode'){
   if(!state.qrAvailable)throw Error('pix service unavailable');
   return {payload:'0'.repeat(60),encodedImage:'a'.repeat(140),expirationDate:'2026-11-17T23:59:59'};
  }
  throw Error('Unexpected request '+path);
 }
};
const plugin={name:'pix-only-test',setup(b){
 b.onResolve({filter:/^cloudflare:workers$|(?:^|\/)session$|(?:^|\/)lib\/asaas$/},args=>({path:args.path,namespace:'fake-pix'}));
 b.onLoad({filter:/.*/,namespace:'fake-pix'},args=>{
  if(args.path==='cloudflare:workers')return {contents:'export const env=globalThis.__testPix.env;',loader:'js'};
  if(args.path.endsWith('/session'))return {contents:'export const getUser=()=>globalThis.__testPix.getUser();',loader:'js'};
  return {contents:'export const asaasConfig=()=>globalThis.__testPix.config();export const asaasRequest=(path,opts)=>globalThis.__testPix.request(path,opts);',loader:'js'};
 });
}};
await build({entryPoints:['app/api/billing/pix/route.ts'],outfile:join(folder,'pix.mjs'),
 bundle:true,platform:'node',format:'esm',plugins:[plugin]});
const {POST}=await import(join(folder,'pix.mjs'));
const make=(body={orderId},origin='https://meuritmo.net')=>POST(new Request('https://meuritmo.net/api/billing/pix',{
 method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
function reset(){
 calls=[];state.user={userId:'pix-user'};state.order={id:orderId,provider_subscription_id:'sub_pix_test',
  status:'pending',first_price_cents:1990,base_price_cents:1990,first_paid_at:null};
 state.payment={id:'pay_pix_test',customer:'cus_pix_test',subscription:'sub_pix_test',billingType:'BOLETO',
  value:19.9,status:'PENDING',dueDate:'2026-11-16'};state.qrAvailable=true;
}

test('usuário precisa estar autenticado e possuir o pedido Pix',async()=>{
 reset();state.user=null;assert.equal((await make()).status,401);
 state.user={userId:'another-user'};assert.equal((await make()).status,404);
 reset();assert.equal((await make({orderId:'invalid'})).status,400);
 assert.equal((await make({orderId},'https://evil.example.com')).status,403);
});
test('boletos do Asaas são convertidos para Pix antes da exibição segura',async()=>{
 reset();const r=await make();assert.equal(r.status,200);
 const v=await r.json();
 assert.equal(v.state,'pending');assert.equal(v.paymentMethod,'PIX');
 assert.equal(v.amountCents,1990);assert.equal(v.copyPaste.length,60);
 assert(v.qrCode.startsWith('data:image/png;base64,'));
 assert.equal(JSON.stringify(v).includes('bankSlip'),false);
 assert.equal(calls.filter(x=>x.method==='PUT').length,1);
});
test('sem QR Code habilitado, não exibe boleto nem libera pagamento alternativo',async()=>{
 reset();state.qrAvailable=false;
 const r=await make();assert.equal(r.status,503);
 const v=await r.json();assert.equal(v.state,'unavailable');assert.equal(v.qrCode,undefined);
});
test('cobranças de cartão não podem ser apresentadas como Pix',async()=>{
 reset();state.payment.billingType='CREDIT_CARD';
 const r=await make();assert.equal(r.status,409);
 assert.equal(calls.filter(x=>x.method==='PUT').length,0);
});
test('pagamento já confirmado não disponibiliza um novo QR Code',async()=>{
 reset();state.payment.status='RECEIVED';const r=await make();
 assert.equal(r.status,200);assert.equal((await r.json()).state,'paid');
 assert.equal(calls.some(x=>x.path.includes('pixQrCode')),false);
});
after(async()=>{delete globalThis.__testPix;await rm(folder,{recursive:true,force:true});});
