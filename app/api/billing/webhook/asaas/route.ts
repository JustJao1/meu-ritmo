import {env} from 'cloudflare:workers';
import {asaasConfig,asaasRequest,hasValidAsaasWebhookToken,type AsaasPayment} from '../../../../../lib/asaas';

const paid=new Set(['CONFIRMED','RECEIVED']);
const reversed=new Set(['REFUNDED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','DELETED']);
function periodEnd(due:string,cycle:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(due))throw Error('Data inválida.');
  const d=new Date(due+'T12:00:00Z');
  if(!Number.isFinite(d.getTime()))throw Error('Data inválida.');
  if(cycle==='year')d.setUTCFullYear(d.getUTCFullYear()+1);else d.setUTCMonth(d.getUTCMonth()+1);
  return Math.floor(d.getTime()/1000);
}
export async function POST(req:Request){
  const config=asaasConfig();
  if(!config.enabled)return Response.json({error:'Webhook não ativado.'},{status:503});
  if(!hasValidAsaasWebhookToken(req.headers.get('asaas-access-token')))return Response.json({error:'Não autorizado.'},{status:401});
  let event:any;
  try{event=await req.json();}catch{return Response.json({error:'JSON inválido.'},{status:400});}
  if(typeof event?.id!=='string'||event.id.length>150||typeof event.event!=='string'||typeof event.payment?.id!=='string')
    return Response.json({error:'Evento inválido.'},{status:400});
  if(await env.DB!.prepare('SELECT event_id FROM asaas_webhook_events WHERE event_id=?').bind(event.id).first())return Response.json({received:true});
  if(!event.event.startsWith('PAYMENT_'))return Response.json({received:true});
  try{
    const payment=await asaasRequest<AsaasPayment>('/payments/'+encodeURIComponent(event.payment.id));
    if(payment.id!==event.payment.id||!payment.subscription)return Response.json({received:true});
    const order=await env.DB!.prepare('SELECT * FROM asaas_orders WHERE provider_subscription_id=?').bind(payment.subscription).first<any>();
    if(!order)return Response.json({error:'Assinatura ainda não registrada.'},{status:503});
    const customer=await env.DB!.prepare('SELECT customer_id FROM asaas_customers WHERE user_id=?').bind(order.user_id).first<any>();
    if(!customer||customer.customer_id!==payment.customer)return Response.json({error:'Vínculo do pagamento inválido.'},{status:409});
    const amount=Math.round(payment.value*100),expected=order.first_paid_at?order.base_price_cents:order.first_price_cents;
    if(amount!==expected)return Response.json({error:'Valor do pagamento divergente.'},{status:409});
    const time=Math.floor(Date.now()/1000),confirmed=paid.has(payment.status);
    const statements=[
      env.DB!.prepare('INSERT INTO asaas_payments(payment_id,order_id,status,amount_cents,paid_at,due_date,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(payment_id) DO UPDATE SET status=excluded.status,paid_at=COALESCE(excluded.paid_at,asaas_payments.paid_at),updated_at=excluded.updated_at')
        .bind(payment.id,order.id,payment.status,amount,confirmed?time:null,payment.dueDate||null,time),
      env.DB!.prepare('INSERT INTO asaas_webhook_events(event_id,event_type,received_at) VALUES (?,?,?) ON CONFLICT(event_id) DO NOTHING').bind(event.id,event.event,time)
    ];
    if(confirmed){
      if(order.coupon_id&&!order.first_paid_at){
        // Revert subsequent renewals to the standard price after the discounted first payment.
        await asaasRequest('/subscriptions/'+encodeURIComponent(payment.subscription),{method:'PUT',body:{value:order.base_price_cents/100}});
      }
      const until=periodEnd(payment.dueDate,order.plan_code.endsWith('_year')?'year':'month');
      statements.push(env.DB!.prepare("INSERT INTO subscriptions(user_id,subscription_id,plan,status,updated_at,valid_until) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET subscription_id=excluded.subscription_id,plan=excluded.plan,status=excluded.status,updated_at=excluded.updated_at,valid_until=MAX(COALESCE(subscriptions.valid_until,0),excluded.valid_until)")
        .bind(order.user_id,payment.subscription,order.plan_code.split('_')[0],'active',time,until));
      statements.push(env.DB!.prepare("UPDATE asaas_orders SET status='active',first_paid_at=COALESCE(first_paid_at,?) WHERE id=?").bind(time,order.id));
    }else if(reversed.has(payment.status)){
      statements.push(env.DB!.prepare("UPDATE subscriptions SET status='canceled',updated_at=? WHERE user_id=? AND subscription_id=?").bind(time,order.user_id,payment.subscription));
    }
    await env.DB!.batch(statements);
    return Response.json({received:true});
  }catch{return Response.json({error:'Falha na conciliação. O Asaas poderá reenviar.'},{status:503});}
}
