import {getUser} from '../../../session';
import {env} from 'cloudflare:workers';
import {asaasConfig,asaasRequest} from '../../../../lib/asaas';
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
    return Response.json({orderId:order.id,status:card.status==='PAID'?'awaiting_webhook':'card_disabled',
      url:null,message:'Novos pagamentos são exclusivamente por Pix. Checkouts antigos de cartão não serão reabertos.'},
      {headers:{'Cache-Control':'no-store'}});
  }
  if(order.status==='cancelled')
    return Response.json({orderId:order.id,status:'cancelled',url:null},{headers:{'Cache-Control':'no-store'}});
  return Response.json({orderId:order.id,status:order.status,
    url:'/pagar?pedido='+encodeURIComponent(order.id)},{headers:{'Cache-Control':'no-store'}});

}
