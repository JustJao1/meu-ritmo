import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const folder=await mkdtemp(join(tmpdir(),'mr-asaas-quarantine-'));
const db=new DatabaseSync(':memory:');
const migration=readFileSync('drizzle/0015_asaas_webhook_reviews.sql','utf8').replace(/--> statement-breakpoint/g,'');
db.exec(migration);
db.exec("CREATE TABLE asaas_orders(id TEXT PRIMARY KEY,status TEXT NOT NULL)");
db.prepare('INSERT INTO asaas_orders(id,status) VALUES (?,?)').run('order-1','pending');
const prepare=sql=>({bind(...values){return{
 execute(){return db.prepare(sql).run(...values);}
}}});
globalThis.__reviewTestEnv={DB:{prepare,async batch(queries){
 db.exec('BEGIN');
 try{for(const query of queries)query.execute();db.exec('COMMIT');}
 catch(e){db.exec('ROLLBACK');throw e;}
}}};
const plugin={name:'mock-cloudflare',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'environment',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},()=>({loader:'js',contents:'export const env=globalThis.__reviewTestEnv;'}));
}};
await build({entryPoints:['lib/asaas-webhook-review.ts'],outfile:join(folder,'review.mjs'),
 bundle:true,platform:'node',format:'esm',plugins:[plugin]});
const {recordAsaasReview}=await import(join(folder,'review.mjs'));
test('a mismatched authenticated payment is recorded and acknowledged without granting access',async()=>{
 const event={id:'evt_review_first',event:'PAYMENT_CONFIRMED',payment:{id:'pay_test_123'}};
 const res=await recordAsaasReview(event,'amount_mismatch','order-1');
 assert.equal(res.status,200);
 assert.equal((await res.json()).requiresReview,true);
 assert.equal(db.prepare('SELECT status FROM asaas_orders WHERE id=?').get('order-1').status,'review');
 assert.equal(db.prepare('SELECT count(*) AS n FROM asaas_webhook_reviews').get().n,1);
 assert.equal(db.prepare('SELECT count(*) AS n FROM asaas_webhook_events').get().n,1);
 assert.equal(db.prepare("SELECT payment_id,reason FROM asaas_webhook_reviews WHERE event_id='evt_review_first'").get().reason,'amount_mismatch');
});
test('replays are idempotent, and unrelated subscription has no effect on orders',async()=>{
 const event={id:'evt_review_first',event:'PAYMENT_CONFIRMED',payment:{id:'pay_test_123'}};
 const repeat=await recordAsaasReview(event,'amount_mismatch','order-1');
 assert.equal(repeat.status,200);
 const unknown=await recordAsaasReview({id:'evt_unknown',event:'PAYMENT_RECEIVED',payment:{id:'pay_elsewhere'}},'subscription_unmatched');
 assert.equal(unknown.status,200);
 assert.equal(db.prepare('SELECT count(*) AS n FROM asaas_webhook_reviews').get().n,2);
 assert.equal(db.prepare('SELECT order_id FROM asaas_webhook_reviews WHERE event_id=?').get('evt_unknown').order_id,null);
});
test('payment routes do not grant a plan from mismatched webhooks',()=>{
 const handler=readFileSync('app/api/billing/webhook/asaas/route.ts','utf8');
 const card=readFileSync('lib/asaas-card-webhook.ts','utf8');
 for(const reason of ['subscription_unmatched','customer_mismatch','amount_mismatch','card_checkout_mismatch'])
  assert.ok(handler.includes("recordAsaasReview(event,'"+reason+"'"),reason);
 for(const reason of ['checkout_mismatch','card_subscription_unmatched'])
  assert.ok(card.includes("recordAsaasReview(event,'"+reason+"'"),reason);
 assert.ok(handler.includes('paymentConfirmationEvents.has(event.event)'));
});
after(async()=>{db.close();await rm(folder,{recursive:true,force:true});delete globalThis.__reviewTestEnv;});
