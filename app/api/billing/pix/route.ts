import {env} from 'cloudflare:workers';
import {getUser} from '../../../session';
import {asaasConfig,asaasRequest,type AsaasPayment,type AsaasSubscription} from '../../../../lib/asaas';

type PixData={payload?:string;encodedImage?:string;expirationDate?:string};
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const payId=/^pay_[a-zA-Z0-9_-]{1,90}$/;
const subId=/^sub_[a-zA-Z0-9_-]{1,90}$/;
const noStore={'Cache-Control':'no-store'};
function output(body:Record<string,unknown>,status=200){return Response.json(body,{status,headers:noStore});}
export async function POST(req:Request){
  const u=await getUser();
  if(!u)return output({error:'Entre na sua conta para acessar o pagamento Pix.'},401);
  if(req.headers.get('origin')!==new URL(req.url).origin)return output({error:'Origem inválida.'},403);
  if(!asaasConfig().apiReady)return output({error:'Consulta do pagamento Pix indisponível.'},503);
  const input=await req.json().catch(()=>null);
  const id=typeof input?.orderId==='string'?input.orderId:'';
  if(!uuid.test(id))return output({error:'Identificador de pedido inválido.'},400);
  const order=await env.DB!.prepare("SELECT id,provider_subscription_id,status,first_price_cents,base_price_cents,first_paid_at FROM asaas_orders WHERE id=? AND user_id=?")
    .bind(id,u.userId).first<{id:string;provider_subscription_id:string|null;status:string;first_price_cents:number;base_price_cents:number;first_paid_at:number|null}>();
  if(!order)return output({error:'Este pagamento não foi encontrado na sua conta.'},404);
  if(order.status==='cancelled')return output({state:'cancelled',message:'A assinatura foi cancelada.'});
  if(!['pending','active'].includes(order.status))return output({state:'unavailable',message:'Sua contratação precisa de conferência antes do pagamento.'},409);
  if(!order.provider_subscription_id||!subId.test(order.provider_subscription_id))
    return output({state:'waiting',message:'A assinatura ainda está sendo registrada.'},202);
  const customer=await env.DB!.prepare('SELECT customer_id FROM asaas_customers WHERE user_id=?')
    .bind(u.userId).first<{customer_id:string}>();
  if(!customer?.customer_id)return output({error:'Vínculo do pagador indisponível.'},409);
  try{
    const subscription=await asaasRequest<AsaasSubscription>('/subscriptions/'+encodeURIComponent(order.provider_subscription_id));
    if(subscription.id!==order.provider_subscription_id||subscription.customer!==customer.customer_id||
      subscription.externalReference!==order.id||subscription.billingType==='CREDIT_CARD')
      return output({error:'Não foi possível validar o vínculo da assinatura Pix.'},409);
    const list=await asaasRequest<{data:AsaasPayment[]}>('/subscriptions/'+encodeURIComponent(order.provider_subscription_id)+'/payments?limit=30');
    const pending=list.data?.find(p=>['PENDING','OVERDUE'].includes(p.status));
    if(!pending){
      if(list.data?.some(p=>['CONFIRMED','RECEIVED'].includes(p.status)))
        return output({state:'paid',message:'Pagamento confirmado. O acesso será atualizado após o recebimento do webhook.'});
      return output({state:'waiting',message:'O Asaas ainda não emitiu a próxima cobrança Pix.'},202);
    }
    const expected=order.first_paid_at?order.base_price_cents:order.first_price_cents;
    if(!payId.test(pending.id||'')||pending.customer!==customer.customer_id||
      pending.subscription!==order.provider_subscription_id||
      Math.round(pending.value*100)!==expected||
      !/^\d{4}-\d{2}-\d{2}$/.test(pending.dueDate||'')||
      !['BOLETO','PIX','UNDEFINED'].includes(pending.billingType)){
      return output({error:'Os dados da cobrança não correspondem ao seu pedido. Nenhum Pix será exibido.'},409);
    }
    let payment=pending;
    if(payment.billingType!=='PIX'){
      const updated=await asaasRequest<AsaasPayment>('/payments/'+encodeURIComponent(payment.id),{
        method:'PUT',body:{billingType:'PIX',value:payment.value,dueDate:payment.dueDate}
      });
      if(updated.id!==payment.id||updated.billingType!=='PIX')
        return output({error:'O Asaas não confirmou a conversão da cobrança para Pix.'},503);
      payment=await asaasRequest<AsaasPayment>('/payments/'+encodeURIComponent(payment.id));
    }
    if(payment.billingType!=='PIX'||!['PENDING','OVERDUE'].includes(payment.status)||
      payment.customer!==customer.customer_id||payment.subscription!==order.provider_subscription_id||
      Math.round(payment.value*100)!==expected)
      return output({error:'A cobrança Pix não passou na verificação final.'},409);
    let pix:PixData;
    try{pix=await asaasRequest<PixData>('/payments/'+encodeURIComponent(payment.id)+'/pixQrCode');}
    catch{return output({state:'unavailable',error:'O Asaas não liberou o QR Code Pix. Verifique se o recebimento por Pix está habilitado na conta Asaas.'},503);}
    if(typeof pix.payload!=='string'||pix.payload.length<40||pix.payload.length>1200||
      typeof pix.encodedImage!=='string'||pix.encodedImage.length<100||pix.encodedImage.length>500000||
      !/^[A-Za-z0-9+/=]+$/.test(pix.encodedImage))
      return output({state:'unavailable',error:'O Asaas não retornou um QR Code Pix válido.'},503);
    return output({state:'pending',paymentMethod:'PIX',amountCents:Math.round(payment.value*100),
      dueDate:payment.dueDate,qrCode:'data:image/png;base64,'+pix.encodedImage,
      copyPaste:pix.payload,expiresAt:pix.expirationDate||null});
  }catch{return output({state:'unavailable',error:'Não foi possível consultar o pagamento Pix no Asaas. Tente novamente mais tarde.'},503);}
}
