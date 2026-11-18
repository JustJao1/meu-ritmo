import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const folder=await mkdtemp(join(tmpdir(),'mr-coupon-pix-'));
const db=new DatabaseSync(':memory:');
for(const file of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())
 db.exec((await readFile('drizzle/'+file,'utf8')).replace(/--> statement-breakpoint/g,''));
const DB={prepare(sql){return{bind(...args){return{
 async first(){return db.prepare(sql).get(...args)||null},
 async run(){const result=db.prepare(sql).run(...args);return{meta:{changes:result.changes}}}
}}}}};
globalThis.__couponTestEnv={DB};
const plugin={name:'mock-cloudflare-env',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'environment',namespace:'coupon-test'}));
 b.onLoad({filter:/.*/,namespace:'coupon-test'},()=>({
  loader:'js',contents:'export const env=globalThis.__couponTestEnv;'
 }));
}};
await build({entryPoints:['lib/asaas-coupons.ts'],outfile:join(folder,'coupons.mjs'),
 bundle:true,format:'esm',platform:'node',plugins:[plugin]});
const {quoteCoupon,reserveCoupon,discountedCents}=await import(join(folder,'coupons.mjs'));
const until=Math.floor(Date.now()/1000)+86400;
const couponId='aaaaaaaa-bbbb-4ccc-8ddd-123412341234';
const coupon2='bbbbbbbb-cccc-4ddd-8eee-123412341234';
const order='cccccccc-dddd-4eee-8fff-123412341234';
const order2='dddddddd-eeee-4fff-8aaa-123412341234';
db.prepare('INSERT INTO discount_codes(id,code,label,plan,kind,value,expires_at,max_uses,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
 .run(couponId,'TESTE-10','Teste desconto','plus','percent',10,until,1,until-1000);
db.prepare('INSERT INTO discount_codes(id,code,label,plan,kind,value,expires_at,max_uses,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
 .run(coupon2,'TESTE-VALOR','Teste valor','all','amount',1800,until,3,until-1000);
db.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES (?,?,?,?,?,'pending',?)")
 .run(order,'payer','plus_month',1990,1791,until-1000);

test('cupom com porcentagem e exclamação pode ser usado no checkout Pix',async()=>{
 db.prepare('INSERT INTO discount_codes(id,code,label,plan,kind,value,expires_at,max_uses,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
  .run(crypto.randomUUID(),'30%OFF!','30% De Desconto!','all','percent',30,until,1000,until-1000);
 const result=await quoteCoupon('plus_month',' 30%off! ','comprador-cupom-especial');
 assert.equal(result.coupon.code,'30%OFF!');
 assert.equal(result.price,1393);
});

test('cupom porcentual calcula valor real do Plus e respeita o plano',async()=>{
 const quote=await quoteCoupon('plus_month',' teste-10 ','payer');
 assert.equal(quote.price,1791);
 assert.equal(discountedCents(1990,{kind:'percent',value:10}),1791);
 await assert.rejects(()=>quoteCoupon('pro_month','TESTE-10','payer'),/indisponível/);
});
test('a reserva bloqueia segundo uso, inclusive antes do pagamento',async()=>{
 const {coupon}=await quoteCoupon('plus_month','TESTE-10','payer');
 await reserveCoupon(order,'payer',coupon);
 await assert.rejects(()=>quoteCoupon('plus_month','TESTE-10','payer'),/já foi utilizado/);
 await assert.rejects(()=>quoteCoupon('plus_month','TESTE-10','other'),/limite de usos/);
});
test('cancelar checkout Pix sem pagamento devolve uso ao estoque e permite reutilizar',async()=>{
 db.prepare("UPDATE asaas_orders SET status='cancelled' WHERE id=?").run(order);
 db.prepare("DELETE FROM asaas_coupon_uses WHERE order_id=? AND EXISTS(SELECT 1 FROM asaas_orders WHERE id=? AND status='cancelled' AND first_paid_at IS NULL)").run(order,order);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM asaas_coupon_uses WHERE coupon_id=?").get(couponId).n,0);
 assert.equal((await quoteCoupon('plus_month','TESTE-10','payer')).price,1791);
});
test('um cupom de valor não pode reduzir o Pix para menos de cinco reais',async()=>{
 await assert.rejects(()=>quoteCoupon('plus_month','TESTE-VALOR','payer'),/R\$ 5,00/);
 assert.equal((await quoteCoupon('pro_month','TESTE-VALOR','payer')).price,1190);
});
test('rotas de cancelamento liberam a reserva apenas se não houve pagamento',()=>{
 const api=readFileSync('app/api/billing/cancel/route.ts','utf8');
 const webhook=readFileSync('lib/asaas-hosted-pix-settlement.ts','utf8');
 for(const src of [api,webhook]){
  assert.match(src,/DELETE FROM asaas_coupon_uses WHERE order_id=\?/);
  assert.match(src,/status='cancelled' AND first_paid_at IS NULL/);
 }
 const quote=readFileSync('app/api/billing/quote/route.ts','utf8');
 const checkout=readFileSync('app/api/billing/checkout/route.ts','utf8');
 assert.match(quote,/quoteCoupon\(price,discountCode,user\.userId\)/);
 assert.match(checkout,/quoteCoupon\(plan,data\.discountCode,user\.userId\)/);
 assert.match(checkout,/amountCents:first/);
});
test('o cancelamento não libera reservas de cobranças já pagas',async()=>{
 db.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,status,created_at,first_paid_at) VALUES (?,?,?,?,?,'cancelled',?,?)")
 .run(order2,'paid','plus_month',1990,1791,until-1000,until-500);
 db.prepare('INSERT INTO asaas_coupon_uses(coupon_id,user_id,order_id,used_at) VALUES (?,?,?,?)')
 .run(couponId,'paid',order2,until-700);
 db.prepare("DELETE FROM asaas_coupon_uses WHERE order_id=? AND EXISTS(SELECT 1 FROM asaas_orders WHERE id=? AND status='cancelled' AND first_paid_at IS NULL)").run(order2,order2);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM asaas_coupon_uses WHERE order_id=?').get(order2).n,1);
});
after(async()=>{db.close();await rm(folder,{recursive:true,force:true});delete globalThis.__couponTestEnv});
