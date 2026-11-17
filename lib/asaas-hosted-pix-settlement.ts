/** Reconcile one-off hosted Pix against the Asaas payment API.
 * Checkout callbacks/webhooks only initiate verification; neither one is
 * sufficient to grant access without a confirmed, customer-bound charge.
 */
import {env} from 'cloudflare:workers';
import {asaasRequest,type AsaasPayment} from './asaas';
import {hostedCheckoutUrl,paidThrough,type PixPlan} from './asaas-hosted-pix';

const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const confirmed=new Set(['CONFIRMED','RECEIVED']);
const reversed=new Set(['REFUNDED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE']);
const accepted=new Set(['PIX']);
const ok=()=>Response.json({received:true});
const now=()=>Math.floor(Date.now()/1000);
type Payment=AsaasPayment&{checkoutSession?:string;paymentDate?:string};
type HostedOrder={
 order_id:string;checkout_id:string;customer_id:string;checkout_status:string;
 user_id:string;plan_code:PixPlan;first_price_cents:number;order_status:string;first_paid_at:number|null
};
const orderQuery=
 "SELECT h.order_id,h.checkout_id,h.customer_id,h.status AS checkout_status,"+
 "o.user_id,o.plan_code,o.first_price_cents,o.status AS order_status,o.first_paid_at "+
 "FROM asaas_hosted_pix_checkouts h JOIN asaas_orders o ON o.id=h.order_id ";

function matches(payment:Payment,row:HostedOrder){
 return payment.customer===row.customer_id&&
  accepted.has(payment.billingType)&&
  Math.round(payment.value*100)===row.first_price_cents&&
  !payment.subscription&&(!payment.checkoutSession||payment.checkoutSession===row.checkout_id);
}
async function listCheckoutPayments(row:HostedOrder){
 const list=await asaasRequest<{data:Payment[]}>('/payments?checkoutSession='+encodeURIComponent(row.checkout_id)+'&limit=30');
 if(!Array.isArray(list.data))throw Error('Lista de cobranças inconsistente.');
 return list.data.filter(payment=>matches(payment,row));
}
function paymentDay(payment:Payment){
 if(payment.paymentDate&&/^\d{4}-\d{2}-\d{2}$/.test(payment.paymentDate)){
  const ts=Date.parse(payment.paymentDate+'T12:00:00Z');
  if(Number.isFinite(ts))return Math.floor(ts/1000);
 }
 return now();
}
export async function reconcileHostedPix(row:HostedOrder){
 if(row.order_status==='cancelled'||row.order_status==='expired')return {state:'cancelled' as const};
 if(row.first_paid_at||row.order_status==='active')return {state:'paid' as const};
 if(row.checkout_status==='CANCELED'||row.checkout_status==='EXPIRED')return {state:'cancelled' as const};
 const payments=await listCheckoutPayments(row);
 const eligible=payments.filter(p=>confirmed.has(p.status));
 if(eligible.length!==1)return {state:'pending' as const};
 const candidate=eligible[0];
 if(!/^pay_[A-Za-z0-9_-]{1,90}$/.test(candidate.id))return {state:'review' as const};
 const payment=await asaasRequest<Payment>('/payments/'+encodeURIComponent(candidate.id));
 if(payment.id!==candidate.id||!matches(payment,row)||!confirmed.has(payment.status))return {state:'review' as const};
 const time=now(),until=paidThrough(paymentDay(payment),row.plan_code);
 if(until<=time)return {state:'review' as const};
 const synthetic='checkout_'+row.checkout_id;
 await env.DB!.batch([
  env.DB!.prepare('INSERT INTO asaas_payments(payment_id,order_id,status,amount_cents,paid_at,due_date,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(payment_id) DO UPDATE SET status=excluded.status,paid_at=COALESCE(asaas_payments.paid_at,excluded.paid_at),updated_at=excluded.updated_at')
    .bind(payment.id,row.order_id,payment.status,row.first_price_cents,time,payment.dueDate||null,time),
  env.DB!.prepare("UPDATE asaas_hosted_pix_checkouts SET status='PAID',updated_at=? WHERE order_id=? AND status IN ('ACTIVE','PAID')")
    .bind(time,row.order_id),
  env.DB!.prepare("UPDATE asaas_orders SET status='active',first_paid_at=COALESCE(first_paid_at,?) WHERE id=? AND status IN ('pending','active') AND cancelled_at IS NULL")
    .bind(time,row.order_id),
  env.DB!.prepare("INSERT INTO subscriptions(user_id,subscription_id,plan,status,updated_at,valid_until) "+
     "SELECT ? ,? ,? ,'active',?,? WHERE EXISTS(SELECT 1 FROM asaas_orders WHERE id=? AND status='active' AND cancelled_at IS NULL) "+
     "ON CONFLICT(user_id) DO UPDATE SET subscription_id=excluded.subscription_id,plan=excluded.plan,status=excluded.status,updated_at=excluded.updated_at,valid_until=excluded.valid_until "+
     "WHERE COALESCE(subscriptions.valid_until,0)<=? OR subscriptions.subscription_id=excluded.subscription_id")
    .bind(row.user_id,synthetic,row.plan_code.split('_')[0],time,until,row.order_id,time)
 ]);
 return {state:'paid' as const,paymentId:payment.id,validUntil:until};
}
async function findCheckout(id:string):Promise<HostedOrder|null>{
 if(!uuid.test(id))return null;
 return env.DB!.prepare(orderQuery+'WHERE h.checkout_id=?').bind(id).first<HostedOrder>();
}
export async function getHostedPixForUser(userId:string){
 return env.DB!.prepare(orderQuery+"WHERE o.user_id=? ORDER BY o.created_at DESC LIMIT 1").bind(userId).first<HostedOrder>();
}
export function hostedPixInfo(row:HostedOrder){
 return {orderId:row.order_id,status:row.checkout_status==='PAID'?'awaiting_confirmation':row.order_status,
  url:row.order_status==='pending'&&row.checkout_status==='ACTIVE'?hostedCheckoutUrl(row.checkout_id):null,
  renewal:'manual' as const,method:'PIX' as const};
}
export async function hostedPixCheckoutEvent(event:any):Promise<Response>{
 const id=event.checkout?.id;
 const row=await findCheckout(id);
 if(!row)return ok(); // Other checkouts must not affect our users.
 const status:{[key:string]:string}={CHECKOUT_CREATED:'ACTIVE',CHECKOUT_PAID:'PAID',CHECKOUT_CANCELED:'CANCELED',CHECKOUT_EXPIRED:'EXPIRED'};
 const state=status[event.event];
 if(!state)return ok();
 // Reject mismatched remote checkout metadata. Never grant access on an event alone.
 if(event.checkout?.status!==state||
    event.checkout?.externalReference!==row.order_id||
    (event.checkout?.customer&&event.checkout.customer!==row.customer_id)||
    !Array.isArray(event.checkout?.billingTypes)||!event.checkout.billingTypes.includes('PIX')||
    !Array.isArray(event.checkout?.chargeTypes)||!event.checkout.chargeTypes.includes('DETACHED')){
  await env.DB!.prepare("UPDATE asaas_orders SET status='review' WHERE id=? AND status='pending'").bind(row.order_id).run();
  return Response.json({received:true,requiresReview:true});
 }
 const time=now();
 if(state==='PAID'){
  await env.DB!.prepare("UPDATE asaas_hosted_pix_checkouts SET status='PAID',updated_at=? WHERE order_id=? AND status='ACTIVE'")
    .bind(time,row.order_id).run();
  await reconcileHostedPix({...row,checkout_status:'PAID'});
 }else if(state==='CANCELED'||state==='EXPIRED'){
  await env.DB!.batch([
   env.DB!.prepare("UPDATE asaas_hosted_pix_checkouts SET status=?,updated_at=? WHERE order_id=? AND status='ACTIVE'")
    .bind(state,time,row.order_id),
   env.DB!.prepare("UPDATE asaas_orders SET status='cancelled',cancelled_at=? WHERE id=? AND status='pending' AND first_paid_at IS NULL")
    .bind(time,row.order_id),
   env.DB!.prepare("DELETE FROM asaas_coupon_uses WHERE order_id=? AND EXISTS(SELECT 1 FROM asaas_orders WHERE id=? AND status='cancelled' AND first_paid_at IS NULL)")
    .bind(row.order_id,row.order_id)
  ]);
 }
 await env.DB!.prepare('INSERT INTO asaas_webhook_events(event_id,event_type,received_at) VALUES (?,?,?) ON CONFLICT(event_id) DO NOTHING')
  .bind(event.id,event.event,time).run();
 return ok();
}
export async function hostedPixPaymentEvent(event:any,payment:Payment):Promise<Response>{
 if(!payment.checkoutSession||!uuid.test(payment.checkoutSession))return ok();
 const row=await findCheckout(payment.checkoutSession);
 if(!row)return ok();
 if(!matches(payment,row))return Response.json({received:true,requiresReview:true});
 const time=now();
 if(confirmed.has(payment.status)&&['PAYMENT_CONFIRMED','PAYMENT_RECEIVED'].includes(event.event))
  await reconcileHostedPix(row);
 else if(reversed.has(payment.status)){
  const verified=await listCheckoutPayments(row);
  if(verified.some(x=>x.id===payment.id&&reversed.has(x.status))){
   await env.DB!.batch([
    env.DB!.prepare("UPDATE subscriptions SET status='canceled',valid_until=?,updated_at=? WHERE user_id=? AND subscription_id=?")
     .bind(time,time,row.user_id,'checkout_'+row.checkout_id),
    env.DB!.prepare("UPDATE asaas_orders SET status='review' WHERE id=? AND status='active'").bind(row.order_id),
    env.DB!.prepare("UPDATE asaas_payments SET status=?,updated_at=? WHERE payment_id=? AND order_id=?")
     .bind(payment.status,time,payment.id,row.order_id)
   ]);
  }
 }
 await env.DB!.prepare('INSERT INTO asaas_webhook_events(event_id,event_type,received_at) VALUES (?,?,?) ON CONFLICT(event_id) DO NOTHING')
  .bind(event.id,event.event,time).run();
 return ok();
}
