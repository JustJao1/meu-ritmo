import {env} from 'cloudflare:workers';
import {getUser} from '../../../session';
import {asaasConfig,asaasRequest,cancelAsaasSubscription} from '../../../../lib/asaas';
export async function POST(req:Request){
  const user=await getUser();
  if(!user)return Response.json({error:'Entre na conta.'},{status:401});
  if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Origem inválida.'},{status:403});
  if(!asaasConfig().apiReady)return Response.json({error:'Gerenciamento indisponível.'},{status:503});
  const order=await env.DB!.prepare("SELECT id,provider_subscription_id,status,first_paid_at FROM asaas_orders WHERE user_id=? AND status IN ('pending','active','review') ORDER BY created_at DESC LIMIT 1").bind(user.userId).first<any>();
  if(!order)return Response.json({error:'Nenhuma assinatura ativa ou pendente encontrada.'},{status:404});
  if(!order.provider_subscription_id){
    const hostedPix=await env.DB!.prepare('SELECT checkout_id,status FROM asaas_hosted_pix_checkouts WHERE order_id=?')
      .bind(order.id).first<{checkout_id:string;status:string}>();
    if(hostedPix){
      if(order.first_paid_at||order.status==='active'||hostedPix.status==='PAID')
        return Response.json({message:'Este acesso foi pago por período, sem renovação automática. O tempo já pago permanece válido.'});
      if(hostedPix.status!=='ACTIVE')return Response.json({message:'Este checkout não está disponível para pagamento.'});
      try{
        await asaasRequest('/checkouts/'+encodeURIComponent(hostedPix.checkout_id)+'/cancel',{method:'POST'});
        const time=Math.floor(Date.now()/1000);
        await env.DB!.batch([
          env.DB!.prepare("UPDATE asaas_hosted_pix_checkouts SET status='CANCELED',updated_at=? WHERE order_id=? AND status='ACTIVE'")
            .bind(time,order.id),
          env.DB!.prepare("UPDATE asaas_orders SET status='cancelled',cancelled_at=? WHERE id=? AND status='pending' AND first_paid_at IS NULL")
            .bind(time,order.id)
        ]);
        return Response.json({message:'Pagamento Pix pendente cancelado. Nenhum plano foi liberado.'});
      }catch{return Response.json({error:'Não foi possível cancelar o checkout Pix no Asaas.'},{status:503});}
    }
    // Hosted card checkout has no subscription until the payer completes it.
    const checkout=await env.DB!.prepare('SELECT checkout_id,status FROM asaas_card_checkouts WHERE order_id=?')
      .bind(order.id).first<{checkout_id:string;status:string}>();
    if(!checkout)return Response.json({error:'A contratação ainda não foi registrada no Asaas.'},{status:404});
    if(checkout.status==='PAID')return Response.json({error:'O cartão foi processado. Aguarde a confirmação da assinatura antes de cancelar a renovação.'},{status:409});
    if(checkout.status!=='ACTIVE')return Response.json({error:'Este checkout já foi encerrado.'},{status:409});
    try{
      await asaasRequest('/checkouts/'+encodeURIComponent(checkout.checkout_id)+'/cancel',{method:'POST'});
      const now=Math.floor(Date.now()/1000);
      await env.DB!.batch([
        env.DB!.prepare("UPDATE asaas_card_checkouts SET status='CANCELED',updated_at=? WHERE order_id=? AND status='ACTIVE'").bind(now,order.id),
        env.DB!.prepare("UPDATE asaas_orders SET status='cancelled',cancelled_at=? WHERE id=? AND status='pending' AND provider_subscription_id IS NULL").bind(now,order.id)
      ]);
      return Response.json({message:'Checkout de cartão cancelado. Nenhum plano foi ativado.'});
    }catch{return Response.json({error:'Não foi possível cancelar o checkout no Asaas. Consulte a situação antes de tentar novamente.'},{status:503});}
  }
  try{
    await cancelAsaasSubscription(order.provider_subscription_id);
    await env.DB!.prepare("UPDATE asaas_orders SET status='cancelled',cancelled_at=? WHERE id=?").bind(Math.floor(Date.now()/1000),order.id).run();
    // Keep previously paid benefits until valid_until. No new renewals are generated.
    return Response.json({message:order.first_paid_at?'Renovação cancelada. O acesso já pago permanece até o vencimento.':'Assinatura cancelada. Nenhum acesso pago foi ativado.'});
  }catch{return Response.json({error:'Não foi possível cancelar no Asaas. Tente novamente.'},{status:503});}
}
