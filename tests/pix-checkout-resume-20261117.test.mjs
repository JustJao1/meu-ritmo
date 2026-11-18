import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

const checkout=readFileSync('app/api/billing/checkout/route.ts','utf8');
const quote=readFileSync('app/api/billing/quote/route.ts','utf8');
const app=readFileSync('app/ritmo.tsx','utf8');
const portal=readFileSync('app/api/billing/portal/route.ts','utf8');
const cancel=readFileSync('app/api/billing/cancel/route.ts','utf8');

test('checkout antigo é retomado antes de criar qualquer cobrança nova',()=>{
 const resume=checkout.indexOf('const openOrder=await env.DB!');
 const creation=checkout.indexOf('const id=crypto.randomUUID()');
 assert.ok(resume>0&&creation>resume);
 assert.match(checkout,/WHERE o\.user_id=\? AND o\.status IN \('creating','pending','review'\)/);
 assert.match(checkout,/openOrder\.checkout_status==='ACTIVE'/);
 assert.match(checkout,/samePrice&&sameCoupon/);
 assert.match(checkout,/now-openOrder\.created_at<3000/);
 assert.match(checkout,/resumed:true,url:hostedCheckoutUrl\(openOrder\.checkout_id\)/);
 assert.match(checkout,/action:'existing_order'/);
});
test('assinatura já confirmada é verificada antes de retomar pagamento',()=>{
 assert.ok(checkout.indexOf('const paid=await env.DB!')<
   checkout.indexOf('const openOrder=await env.DB!'));
 assert.match(checkout,/Você já possui uma assinatura ativa/);
});
test('orçamento conserva o valor e cupom previamente reservado somente para mesma conta e plano',()=>{
 assert.match(quote,/WHERE o\.user_id=\? AND o\.status='pending' AND o\.first_paid_at IS NULL/);
 assert.match(quote,/previous\.plan_code===price/);
 assert.match(quote,/previous\.coupon_code\|\|''/);
 assert.match(quote,/checkout_status==='ACTIVE'/);
 assert.match(quote,/firstAmountCents:previous\.first_price_cents/);
 assert.match(quote,/checkoutAvailable:asaasConfig\(\)\.enabled,resumed:true/);
});
test('portal e cancelamento são a alternativa para pedido com status divergente',()=>{
 assert.match(portal,/hostedCheckoutUrl\(pix\.checkout_id\)/);
 assert.match(cancel,/\/checkouts\/'\+encodeURIComponent\(hostedPix\.checkout_id\)\+'\/cancel'/);
 assert.match(checkout,/Consulte a fatura ou cancele o Pix pendente/);
});
test('benefícios reconhecem plano legítimo por compra, código e concessão administrativa',()=>{
 assert.match(app,/accountAccess&&accountAccess\.source!=='free'&&accountAccess\.source!=='early_access'/);
 assert.match(app,/requestedPlan==='plus'\?\['plus','pro'\]\.includes\(accountPlan\):accountPlan==='pro'/);
 assert.match(app,/onClick=\{\(\)=>beginPurchase\(requestedPlan\)\}/);
});
test('índice de uma contratação aberta continua protegendo contra cobranças duplicadas',()=>{
 const schema=readFileSync('drizzle/0008_asaas_billing.sql','utf8');
 assert.match(schema,/CREATE UNIQUE INDEX IF NOT EXISTS asaas_one_open_order_per_user/);
 const db=new DatabaseSync(':memory:');
 db.exec(schema.replace(/--> statement-breakpoint/g,''));
 const t=Math.floor(Date.now()/1000);
 db.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES(?,?,?,?,?,'pending',?)")
  .run('order-1','member','plus_month',1990,1990,t);
 assert.throws(()=>db.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES(?,?,?,?,?,'pending',?)").run('order-2','member','pro_month',2990,2990,t));
 db.close();
});
