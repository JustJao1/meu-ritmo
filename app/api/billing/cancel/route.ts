import {env} from 'cloudflare:workers';
import {getUser} from '../../../session';
import {asaasConfig,cancelAsaasSubscription} from '../../../../lib/asaas';
export async function POST(req:Request){
  const user=await getUser();
  if(!user)return Response.json({error:'Entre na conta.'},{status:401});
  if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Origem inválida.'},{status:403});
  if(!asaasConfig().apiReady)return Response.json({error:'Gerenciamento indisponível.'},{status:503});
  const order=await env.DB!.prepare("SELECT id,provider_subscription_id,status,first_paid_at FROM asaas_orders WHERE user_id=? AND status IN ('pending','active','review') ORDER BY created_at DESC LIMIT 1").bind(user.userId).first<any>();
  if(!order?.provider_subscription_id)return Response.json({error:'Nenhuma assinatura ativa ou pendente encontrada.'},{status:404});
  try{
    await cancelAsaasSubscription(order.provider_subscription_id);
    await env.DB!.prepare("UPDATE asaas_orders SET status='cancelled',cancelled_at=? WHERE id=?").bind(Math.floor(Date.now()/1000),order.id).run();
    // Keep previously paid benefits until valid_until. No new renewals are generated.
    return Response.json({message:order.first_paid_at?'Renovação cancelada. O acesso já pago permanece até o vencimento.':'Assinatura cancelada. Nenhum acesso pago foi ativado.'});
  }catch{return Response.json({error:'Não foi possível cancelar no Asaas. Tente novamente.'},{status:503});}
}
