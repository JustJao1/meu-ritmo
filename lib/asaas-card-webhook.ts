import {env} from 'cloudflare:workers';
import {asaasRequest,type AsaasSubscription} from './asaas';

type CardOrder={order_id:string;checkout_id:string;customer_id:string;checkout_status:string;order_status:string;plan_code:string;first_price_cents:number;provider_subscription_id:string|null;created_at:number};
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const subscriptionId=/^sub_[A-Za-z0-9_-]{1,90}$/;
const customerId=/^cus_[A-Za-z0-9_-]{5,90}$/;
const ok=()=>Response.json({received:true});
const now=()=>Math.floor(Date.now()/1000);
type RemoteSubscription=AsaasSubscription & {deleted?:boolean;externalReference?:string|null};

async function storeEvent(event:any){
 await env.DB!.prepare('INSERT INTO asaas_webhook_events(event_id,event_type,received_at) VALUES (?,?,?) ON CONFLICT(event_id) DO NOTHING')
  .bind(event.id,event.event,now()).run();
}

/** A checkout-paid webhook only validates its journey. It never activates a plan. */
async function checkoutEvent(event:any){
 const checkout=event.checkout;
 if(!uuid.test(checkout?.id||''))return Response.json({error:'Checkout inválido.'},{status:400});
 const row=await env.DB!.prepare('SELECT c.order_id,c.customer_id,c.status AS checkout_status,o.plan_code,o.first_price_cents FROM asaas_card_checkouts c JOIN asaas_orders o ON o.id=c.order_id WHERE c.checkout_id=?')
  .bind(checkout.id).first<{order_id:string;customer_id:string;checkout_status:string;plan_code:string;first_price_cents:number}>();
 if(!row)return ok(); // Asaas may send events for unrelated checkouts.
 const states:{[key:string]:string}={CHECKOUT_CREATED:'ACTIVE',CHECKOUT_PAID:'PAID',CHECKOUT_CANCELED:'CANCELED',CHECKOUT_EXPIRED:'EXPIRED'};
 const state=states[event.event];
 if(!state)return ok();
 // The webhook is authenticated, and its ID/customer/product are bound to an
 // existing D1 checkout. Never accept a different payer or payment method.
 if((row.customer_id&&checkout.customer!==row.customer_id)||
    (state==='PAID'&&!customerId.test(checkout.customer||''))||
    (!row.customer_id&&state!=='PAID'&&checkout.customer!=null)||
    (checkout.externalReference&&checkout.externalReference!==row.order_id)||
    !Array.isArray(checkout.billingTypes)||
    !checkout.billingTypes.some((type:unknown)=>type==='CREDIT_CARD'||type==='MUNDIPAGG_CIELO')||
    !Array.isArray(checkout.chargeTypes)||!checkout.chargeTypes.includes('RECURRENT')||
    checkout.status!==state)return Response.json({error:'Checkout divergente.'},{status:409});
 // Never roll a confirmed paid checkout back to ACTIVE/EXPIRED via delayed events.
 if(row.checkout_status==='PAID'&&state!=='PAID'){
   await storeEvent(event);return ok();
 }
 const time=now();
 const actions=[
  env.DB!.prepare('UPDATE asaas_card_checkouts SET status=?,customer_id=CASE WHEN ?=\'PAID\' THEN ? ELSE customer_id END,updated_at=? WHERE checkout_id=?')
   .bind(state,state,state==='PAID'?checkout.customer:'',time,checkout.id),
  env.DB!.prepare('INSERT INTO asaas_webhook_events(event_id,event_type,received_at) VALUES (?,?,?) ON CONFLICT(event_id) DO NOTHING')
   .bind(event.id,event.event,time)
 ];
 if(state==='CANCELED'||state==='EXPIRED')
  actions.push(env.DB!.prepare("UPDATE asaas_orders SET status='cancelled',cancelled_at=? WHERE id=? AND status='pending' AND provider_subscription_id IS NULL")
   .bind(time,row.order_id));
 await env.DB!.batch(actions);
 return ok();
}

/** Bind the subscription that the hosted checkout created, not an arbitrary
 * subscription from a client's browser. The payment webhook remains the ONLY
 * event which grants a paid Plus/Pro period. */
/** Used both by subscription webhooks and by a payment webhook that arrives
 * before the subscription-created event has been correlated. Never grants access. */
export async function bindCardSubscription(supplied:string):Promise<string|null>{
 if(!subscriptionId.test(supplied||''))return null;
 const actual=await asaasRequest<RemoteSubscription>('/subscriptions/'+encodeURIComponent(supplied));
 if(actual.id!==supplied||!customerId.test(actual.customer||'')||
    actual.billingType!=='CREDIT_CARD'||actual.deleted)return null;
 const candidates=await env.DB!.prepare(
  "SELECT c.order_id,c.checkout_id,c.customer_id,c.status AS checkout_status,c.created_at,o.status AS order_status,o.plan_code,o.first_price_cents,o.provider_subscription_id "+
  "FROM asaas_card_checkouts c JOIN asaas_orders o ON o.id=c.order_id "+
  "WHERE c.customer_id=? AND c.status='PAID' AND o.status IN ('pending','review','active') AND (o.provider_subscription_id IS NULL OR o.provider_subscription_id=?)"
 ).bind(actual.customer,supplied).all<CardOrder>();
 const time=now(),value=Math.round(actual.value*100);
 const matching=candidates.results.filter(c=>
   c.customer_id===actual.customer&&
   c.first_price_cents===value&&
   c.plan_code.endsWith('_year')===(actual.cycle==='YEARLY')&&
   (actual.cycle==='MONTHLY'||actual.cycle==='YEARLY')&&
   c.created_at>=time-86400&&c.created_at<=time+300&&
   (!actual.externalReference||actual.externalReference===c.order_id)
 );
 if(matching.length!==1)return null;
 const found=matching[0];
 await env.DB!.prepare("UPDATE asaas_orders SET provider_subscription_id=?,status=CASE WHEN status='review' THEN 'pending' ELSE status END WHERE id=? AND (provider_subscription_id IS NULL OR provider_subscription_id=?)")
  .bind(supplied,found.order_id,supplied).run();
 return found.order_id;
}
async function subscriptionCreated(event:any){
 const supplied=event.subscription?.id;
 if(!subscriptionId.test(supplied||''))
  return Response.json({error:'Assinatura inválida.'},{status:400});
 const orderId=await bindCardSubscription(supplied);
 if(orderId)await storeEvent(event);
 return ok();
}

export async function handleCardWebhook(event:any):Promise<Response>{
 try{
  if(event.event.startsWith('CHECKOUT_'))return await checkoutEvent(event);
  if(event.event==='SUBSCRIPTION_CREATED')return await subscriptionCreated(event);
  return ok();
 }catch{
  return Response.json({error:'Não foi possível conciliar checkout e assinatura.'},{status:503});
 }
}
