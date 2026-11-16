import {getUser} from '../../../session';
import {env} from 'cloudflare:workers';
import {asaasConfig,asaasRequest,type AsaasPayment} from '../../../../lib/asaas';
function safeInvoice(value:unknown){
  if(typeof value!=='string')return null;
  try{const url=new URL(value);return url.protocol==='https:'&&/(^|\.)asaas\.com$/.test(url.hostname)?url.href:null;}catch{return null;}
}
export async function POST(req:Request){
  const u=await getUser();
  if(!u)return Response.json({error:'Entre na conta.'},{status:401});
  if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Origem inválida.'},{status:403});
  if(!asaasConfig().apiReady)return Response.json({error:'Consulta de faturas indisponível no momento.'},{status:503});
  const order=await env.DB!.prepare("SELECT id,provider_subscription_id,status FROM asaas_orders WHERE user_id=? ORDER BY created_at DESC LIMIT 1").bind(u.userId).first<any>();
  if(!order)return Response.json({error:'Não há assinatura Asaas para gerenciar.'},{status:404});
  if(!order.provider_subscription_id){
    const card=await env.DB!.prepare('SELECT checkout_id,status FROM asaas_card_checkouts WHERE order_id=?')
      .bind(order.id).first<{checkout_id:string;status:string}>();
    if(!card)return Response.json({error:'Nenhuma assinatura encontrada para esta contratação.'},{status:404});
    if(card.status==='ACTIVE')
      return Response.json({orderId:order.id,status:'pending',url:'https://asaas.com/checkoutSession/show?id='+encodeURIComponent(card.checkout_id)},{headers:{'Cache-Control':'no-store'}});
    return Response.json({orderId:order.id,status:card.status==='PAID'?'awaiting_webhook':card.status.toLowerCase(),url:null},
      {headers:{'Cache-Control':'no-store'}});
  }
  try{
    const list=await asaasRequest<{data:AsaasPayment[]}>('/subscriptions/'+encodeURIComponent(order.provider_subscription_id)+'/payments?limit=20');
    const recent=list.data?.find(p=>p.status==='PENDING'||p.status==='OVERDUE')||list.data?.[0];
    return Response.json({orderId:order.id,status:order.status,url:safeInvoice(recent?.invoiceUrl)});
  }catch{return Response.json({error:'Não foi possível consultar sua assinatura.'},{status:503});}
}
