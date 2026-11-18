import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const read=(f)=>readFileSync(f,'utf8');
const checkout=read('app/api/billing/checkout/route.ts');
const cancel=read('app/api/billing/cancel/route.ts');
const status=read('app/api/billing/status/route.ts');
const app=read('app/ritmo.tsx');
const asaas=read('lib/asaas.ts');
const audit=read('scripts/asaas-production-ledger-audit.mjs');
const migration=read('drizzle/0017_asaas_checkout_failure_diagnostics.sql');

test('Asaas classifica rejeições definitivas sem expor mensagem ou credenciais',()=>{
 assert.match(asaas,/export class AsaasApiError extends Error/);
 assert.match(asaas,/throw new AsaasApiError\(response.status\)/);
 assert.doesNotMatch(asaas,/throw new Error\(await response.text\(\)\)/);
});
test('falhas definitivas liberam o cupom; timeout e banco ambíguos permanecem em revisão',()=>{
 assert.match(checkout,/const rejectedCheckout=stage==='checkout_create'/);
 assert.match(checkout,/httpStatus!==null&&\[400,401,403,404,422\]\.includes\(httpStatus\)/);
 assert.match(checkout,/const beforeCheckout=!\['checkout_create','checkout_record'\]\.includes\(stage\)/);
 assert.match(checkout,/const safeToRelease=beforeCheckout\|\|rejectedCheckout/);
 assert.match(checkout,/UPDATE asaas_orders SET status='cancelled',cancelled_at=\?/);
 assert.match(checkout,/DELETE FROM asaas_coupon_uses WHERE order_id=\?/);
 assert.match(checkout,/UPDATE asaas_orders SET status='review' WHERE id=\? AND status='creating'/);
 assert.match(checkout,/Nenhuma cobrança foi criada e o cupom foi liberado/);
});
test('a recuperação exige ausência de pagamento remoto e não aceita cobranças existentes',()=>{
 assert.match(cancel,/order\.status==='review'&&!order\.first_paid_at/);
 assert.match(cancel,/\/payments\?externalReference=/);
 assert.match(cancel,/\/subscriptions\?externalReference=/);
 assert.match(cancel,/if\(payments\.data\.length\|\|subscriptions\.data\.length\)/);
 assert.match(cancel,/NOT EXISTS\(SELECT 1 FROM asaas_hosted_pix_checkouts/);
 assert.match(cancel,/NOT EXISTS\(SELECT 1 FROM asaas_card_checkouts/);
 assert.match(cancel,/first_paid_at IS NULL/);
 assert.match(cancel,/Nenhum plano foi ativado/);
});
test('UI oferece recuperar só quando servidor informa pedido em revisão',()=>{
 assert.match(status,/result\.hasFailedCheckout=!!order&&order\.status==='review'/);
 assert.match(app,/purchaseStatus\?\.hasFailedCheckout&&<div className="billing-recover"/);
 assert.match(app,/Encerrar tentativa com falha e liberar cupom/);
 assert.match(app,/setPurchaseStatus\(await status\.json\(\)\)/);
});
test('auditoria não expõe documento do pagador, apenas contagens de falhas',()=>{
 assert.match(migration,/CREATE TABLE IF NOT EXISTS asaas_checkout_failures/);
 assert.match(migration,/provider_http_status INTEGER/);
 assert.doesNotMatch(migration,/cpfCnpj|email|name TEXT|user_id/);
 assert.match(checkout,/INSERT INTO asaas_checkout_failures/);
 assert.match(audit,/Pedidos em revisão sem checkout/);
 assert.match(audit,/Falhas de checkout por etapa e código HTTP/);
});
test('liberação da reserva é atômica e exige ordem cancelada sem pagamento',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(read('drizzle/0008_asaas_billing.sql').replace(/--> statement-breakpoint/g,''));
 const couponId='coupon-fixture',orderId='review-fixture',paidId='paid-fixture';
 db.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES (?,?,?,?,?,'review',?)").run(orderId,'member1','plus_month',1990,500,1);
 db.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,status,created_at,first_paid_at) VALUES (?,?,?,?,?,'review',?,?)").run(paidId,'member2','plus_month',1990,500,1,2);
 db.prepare('INSERT INTO asaas_coupon_uses(coupon_id,user_id,order_id,used_at) VALUES (?,?,?,?)').run(couponId,'member1',orderId,1);
 db.prepare('INSERT INTO asaas_coupon_uses(coupon_id,user_id,order_id,used_at) VALUES (?,?,?,?)').run(couponId,'member2',paidId,1);
 db.prepare("UPDATE asaas_orders SET status='cancelled' WHERE id=? AND status='review' AND first_paid_at IS NULL").run(orderId);
 db.prepare("DELETE FROM asaas_coupon_uses WHERE order_id=? AND EXISTS(SELECT 1 FROM asaas_orders WHERE id=? AND status='cancelled' AND first_paid_at IS NULL)").run(orderId,orderId);
 db.prepare("UPDATE asaas_orders SET status='cancelled' WHERE id=? AND status='review' AND first_paid_at IS NULL").run(paidId);
 db.prepare("DELETE FROM asaas_coupon_uses WHERE order_id=? AND EXISTS(SELECT 1 FROM asaas_orders WHERE id=? AND status='cancelled' AND first_paid_at IS NULL)").run(paidId,paidId);
 assert.equal(db.prepare('SELECT count(*) n FROM asaas_coupon_uses WHERE order_id=?').get(orderId).n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM asaas_coupon_uses WHERE order_id=?').get(paidId).n,1);
 assert.equal(db.prepare('SELECT status FROM asaas_orders WHERE id=?').get(paidId).status,'review');
 db.close();
});
