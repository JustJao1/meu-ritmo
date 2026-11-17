/** Quarantine verified Asaas webhook events with inconsistent business mapping.
 * Persist first, then acknowledge HTTP 200. Never grant access here.
 * This avoids a single unrelated/malformed remote financial event pausing
 * the entire sequential Asaas queue with repeated HTTP 409 responses.
 */
import {env} from 'cloudflare:workers';

export type AsaasReviewReason=
 'subscription_unmatched'|'customer_mismatch'|'amount_mismatch'|
 'card_checkout_mismatch'|'checkout_mismatch'|'card_subscription_unmatched';

export async function recordAsaasReview(
 event:{id:string;event:string;payment?:{id?:string}},
 reason:AsaasReviewReason,orderId?:string
):Promise<Response>{
 const receivedAt=Math.floor(Date.now()/1000);
 const safePaymentId=typeof event.payment?.id==='string'&&/^pay_[A-Za-z0-9_-]{1,90}$/.test(event.payment.id)
  ?event.payment.id:null;
 const queries=[
  env.DB!.prepare(`INSERT INTO asaas_webhook_reviews
   (event_id,event_type,payment_id,order_id,reason,received_at)
   VALUES (?,?,?,?,?,?)
   ON CONFLICT(event_id) DO NOTHING`)
   .bind(event.id,event.event,safePaymentId,orderId||null,reason,receivedAt),
  env.DB!.prepare(`INSERT INTO asaas_webhook_events(event_id,event_type,received_at)
   VALUES (?,?,?) ON CONFLICT(event_id) DO NOTHING`)
   .bind(event.id,event.event,receivedAt)
 ];
 if(orderId)queries.push(
  env.DB!.prepare("UPDATE asaas_orders SET status='review' WHERE id=? AND status IN ('pending','creating')")
   .bind(orderId)
 );
 await env.DB!.batch(queries);
 return Response.json({received:true,requiresReview:true});
}
