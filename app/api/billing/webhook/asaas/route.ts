import {env} from 'cloudflare:workers';
import {asaasConfig,asaasRequest,hasValidAsaasWebhookToken,type AsaasPayment} from '../../../../../lib/asaas';
import {handleCardWebhook,bindCardSubscription} from '../../../../../lib/asaas-card-webhook';

const paid=new Set(['CONFIRMED','RECEIVED']);
const declinedEvents=new Set(['PAYMENT_CREDIT_CARD_CAPTURE_REFUSED','PAYMENT_REPROVED_BY_RISK_ANALYSIS','PAYMENT_CREDIT_CARD_THREE_D_SECURE_CHALLENGE_FAILED']);
const paymentConfirmationEvents=new Set(['PAYMENT_CONFIRMED','PAYMENT_RECEIVED']);
const reversed=new Set(['REFUNDED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','DELETED']);
const reviewStatuses=new Set(['PARTIALLY_REFUNDED','REFUND_IN_PROGRESS']);
function periodEnd(due:string,cycle:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(due))throw Error('Data inválida.');
  const d=new Date(due+'T12:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==due)throw Error('Data inválida.');
  const year=d.getUTCFullYear()+(cycle==='year'?1:0);
  const month=d.getUTCMonth()+(cycle==='year'?0:1);
  const day=Math.min(d.getUTCDate(),new Date(Date.UTC(year,month+1,0)).getUTCDate());
  return Math.floor(Date.UTC(year,month,day,12)/1000);
}
export async function POST(req:Request){
  const config=asaasConfig();
  if(!config.webhookReady)return Response.json({error:'Webhook não configurado.'},{status:503});
  if(!hasValidAsaasWebhookToken(req.headers.get('asaas-access-token')))return Response.json({error:'Não autorizado.'},{status:401});
  if(Number(req.headers.get('content-length')||0)>65536)return Response.json({error:'Evento muito grande.'},{status:413});
  let event:any;
  try{const raw=await req.text();if(raw.length>65536)return Response.json({error:'Evento muito grande.'},{status:413});event=JSON.parse(raw);}catch{return Response.json({error:'JSON inválido.'},{status:400});}
  if(typeof event?.id!=='string'||event.id.length>150||typeof event.event!=='string'||event.event.length>100)
    return Response.json({error:'Evento inválido.'},{status:400});
  if(event.event.startsWith('PAYMENT_')&&
    (typeof event.payment?.id!=='string'||!/^pay_[A-Za-z0-9_-]{1,90}$/.test(event.payment.id)))
    return Response.json({error:'Pagamento inválido.'},{status:400});
  if(await env.DB!.prepare('SELECT event_id FROM asaas_webhook_events WHERE event_id=?').bind(event.id).first())return Response.json({received:true});
  if(event.event.startsWith('CHECKOUT_')||event.event==='SUBSCRIPTION_CREATED')
    return handleCardWebhook(event);
  if(!event.event.startsWith('PAYMENT_'))return Response.json({received:true});
  try{
    const payment=await asaasRequest<AsaasPayment>('/payments/'+encodeURIComponent(event.payment.id));
    if(payment.id!==event.payment.id||!payment.subscription)return Response.json({received:true});
    let order=await env.DB!.prepare('SELECT * FROM asaas_orders WHERE provider_subscription_id=?').bind(payment.subscription).first<any>();
    if(!order&&payment.billingType==='CREDIT_CARD'){
      // Hosted checkouts can send payment before SUBSCRIPTION_CREATED.
      // Only a unique, already-paid Checkout linked to the same Asaas customer
      // and subscription amount can be correlated; pending checkouts cannot.
      await bindCardSubscription(payment.subscription);
      order=await env.DB!.prepare('SELECT * FROM asaas_orders WHERE provider_subscription_id=?').bind(payment.subscription).first<any>();
    }
    if(!order)return Response.json({error:'Assinatura ainda não registrada.'},{status:503});
    // A card Checkout creates its payer on Asaas after the hosted form is paid.
    // Never infer the payer from a previous Pix customer of the same account.
    const card=await env.DB!.prepare("SELECT customer_id,status FROM asaas_card_checkouts WHERE order_id=?")
      .bind(order.id).first<{customer_id:string;status:string}>();
    if(card){
      if(card.status!=='PAID'||!card.customer_id||card.customer_id!==payment.customer||
         payment.billingType!=='CREDIT_CARD')
        return Response.json({error:'Vínculo do pagamento por cartão inválido.'},{status:409});
    }else{
      const customer=await env.DB!.prepare('SELECT customer_id FROM asaas_customers WHERE user_id=?').bind(order.user_id).first<any>();
      if(!customer||customer.customer_id!==payment.customer)return Response.json({error:'Vínculo do pagamento inválido.'},{status:409});
      // A Pix-only consent must never grant a plan for a paid bank slip or
      // credit-card transaction. Some Asaas receipts retain BOLETO even when
      // actually settled via Pix; pixTransaction proves that settlement method.
      const consent=await env.DB!.prepare('SELECT payment_method FROM asaas_order_consents WHERE order_id=?')
        .bind(order.id).first<{payment_method:string}>();
      if(consent?.payment_method==='PIX'&&paid.has(payment.status)&&paymentConfirmationEvents.has(event.event)&&
         payment.billingType!=='PIX'&&
         !(payment.billingType==='BOLETO'&&typeof (payment as AsaasPayment&{pixTransaction?:string}).pixTransaction==='string'))
        return Response.json({error:'Esta assinatura aceita somente pagamento Pix.'},{status:409});
    }
    const previous=await env.DB!.prepare('SELECT amount_cents FROM asaas_payments WHERE payment_id=?').bind(payment.id).first<{amount_cents:number}>();
    const amount=Math.round(payment.value*100),expected=previous?.amount_cents??(order.first_paid_at?order.base_price_cents:order.first_price_cents);
    if(amount!==expected)return Response.json({error:'Valor do pagamento divergente.'},{status:409});
    const time=Math.floor(Date.now()/1000),confirmed=paid.has(payment.status)&&paymentConfirmationEvents.has(event.event);
    const statements=[
      env.DB!.prepare('INSERT INTO asaas_payments(payment_id,order_id,status,amount_cents,paid_at,due_date,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(payment_id) DO UPDATE SET status=excluded.status,paid_at=COALESCE(excluded.paid_at,asaas_payments.paid_at),updated_at=excluded.updated_at')
        .bind(payment.id,order.id,payment.status,amount,confirmed?time:null,payment.dueDate||null,time),
      env.DB!.prepare('INSERT INTO asaas_webhook_events(event_id,event_type,received_at) VALUES (?,?,?) ON CONFLICT(event_id) DO NOTHING').bind(event.id,event.event,time)
    ];
    if(declinedEvents.has(event.event)){
      statements.push(env.DB!.prepare("UPDATE asaas_orders SET status='review' WHERE id=? AND status='pending'").bind(order.id));
    }
    if(confirmed){
      if(order.coupon_id&&!order.first_paid_at&&order.status!=='cancelled'){
        // A cancelled recurring subscription no longer exists at Asaas. Its paid invoice
        // must still grant the paid period, without attempting to edit that subscription.
        // Future Pix payments return to the full quoted price after the first paid invoice.
        await asaasRequest('/subscriptions/'+encodeURIComponent(payment.subscription),{method:'PUT',body:{value:order.base_price_cents/100}});
      }
      const until=periodEnd(payment.dueDate,order.plan_code.endsWith('_year')?'year':'month');
      statements.push(env.DB!.prepare("INSERT INTO subscriptions(user_id,subscription_id,plan,status,updated_at,valid_until) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET subscription_id=excluded.subscription_id,plan=excluded.plan,status=excluded.status,updated_at=excluded.updated_at,valid_until=MAX(COALESCE(subscriptions.valid_until,0),excluded.valid_until) WHERE subscriptions.subscription_id=excluded.subscription_id OR COALESCE(subscriptions.valid_until,0)<excluded.valid_until")
        .bind(order.user_id,payment.subscription,order.plan_code.split('_')[0],'active',time,until));
      statements.push(env.DB!.prepare("UPDATE asaas_orders SET status=CASE WHEN status='cancelled' THEN 'cancelled' ELSE 'active' END,first_paid_at=COALESCE(first_paid_at,?) WHERE id=?").bind(time,order.id));
    }else if(reversed.has(payment.status)){
      // Keep access from other confirmed invoices after a refund or chargeback.
      // A refunded renewal must not silently erase an earlier period already paid.
      const lastPaid=await env.DB!.prepare("SELECT max(due_date) AS latest FROM asaas_payments WHERE order_id=? AND status IN ('CONFIRMED','RECEIVED') AND payment_id<>?").bind(order.id,payment.id).first<{latest:string|null}>();
      const remainingUntil=lastPaid?.latest?periodEnd(lastPaid.latest,order.plan_code.endsWith('_year')?'year':'month'):0;
      statements.push(env.DB!.prepare("UPDATE subscriptions SET status=?,valid_until=?,updated_at=? WHERE user_id=? AND subscription_id=?")
        .bind(remainingUntil>time?'active':'canceled',remainingUntil,time,order.user_id,payment.subscription));
    }else if(reviewStatuses.has(payment.status)){
      // Partial or in-progress refunds require individual review, not an automatic
      // full revocation of an otherwise paid period.
      statements.push(env.DB!.prepare("UPDATE asaas_orders SET status='review' WHERE id=? AND status!='cancelled'").bind(order.id));
    }
    await env.DB!.batch(statements);
    return Response.json({received:true});
  }catch{return Response.json({error:'Falha na conciliação. O Asaas poderá reenviar.'},{status:503});}
}
