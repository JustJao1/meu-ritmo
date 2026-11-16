import {env} from 'cloudflare:workers';
import {getUser} from '../../../session';
import {EARLY_ACCESS_ACTIVE} from '../../../../lib/entitlements';
import {asaasCardCheckoutReady,asaasConfig,asaasRequest,type AsaasSubscription,type AsaasPayment,type AsaasPlanCode} from '../../../../lib/asaas';
import {priceCents,quoteCoupon,reserveCoupon} from '../../../../lib/asaas-coupons';
import {z} from 'zod';
import {validBrazilTaxId} from '../../../../lib/brazil-tax-id';
import {parseLegalSettings} from '../../../../lib/legal-settings';
import {hostedCardCheckoutPayload} from '../../../../lib/asaas-hosted-card';

const inputSchema=z.object({
  price:z.enum(['plus_month','plus_year','pro_month','pro_year']),
  paymentMethod:z.enum(['PIX','CREDIT_CARD']),
  name:z.string().trim().min(3).max(120),
  cpfCnpj:z.string().trim().min(11).max(18),
  discountCode:z.string().trim().max(32).optional(),
  acceptTerms:z.literal(true),
  acceptRefundPolicy:z.literal(true)
});
function verifiedInvoice(link:unknown){
  if(typeof link!=='string')return null;
  try{const url=new URL(link);return url.protocol==='https:'&&/(^|\.)asaas\.com$/.test(url.hostname)?url.toString():null;}catch{return null;}
}
export async function POST(req:Request){
  if(EARLY_ACCESS_ACTIVE)return Response.json({error:'Assinaturas indisponíveis durante o acesso antecipado.'},{status:503});
  const user=await getUser();
  if(!user)return Response.json({error:'Entre na sua conta.'},{status:401});
  if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Origem inválida.'},{status:403});
  if(!asaasConfig().enabled)return Response.json({error:'Pagamento ainda não configurado.'},{status:503});
  const parsed=inputSchema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return Response.json({error:'Confira o plano, os dados do titular, os termos e a política de cancelamento e reembolso.'},{status:400});
  const data=parsed.data,cpfCnpj=data.cpfCnpj.replace(/\D/g,'');
  if(!validBrazilTaxId(cpfCnpj))return Response.json({error:'CPF ou CNPJ inválido. Confira os dígitos informados.'},{status:400});
  const now=Math.floor(Date.now()/1000);
  const legalRecord=await env.DB!.prepare("SELECT value FROM service_settings WHERE key='legal'").first<{value:string}>();
  if(!parseLegalSettings(legalRecord?.value))return Response.json({error:'Identificação comercial do fornecedor pendente ou inválida. Não é possível contratar neste momento.'},{status:503});
  const paid=await env.DB!.prepare('SELECT status,valid_until FROM subscriptions WHERE user_id=?').bind(user.userId).first<any>();
  if(paid&&['active','trialing'].includes(paid.status)&&(paid.valid_until||0)>now)return Response.json({error:'Você já possui uma assinatura ativa.'},{status:409});
  const plan=data.price as AsaasPlanCode;
  let coupon:Awaited<ReturnType<typeof quoteCoupon>>|null=null;
  try{if(data.discountCode)coupon=await quoteCoupon(plan,data.discountCode);}catch(e){return Response.json({error:(e as Error).message},{status:400});}
  // Asaas requires card tokenization to change a card subscription's recurring value.
  // Until that configuration is validated, do not promise a first-cycle card discount
  // that could silently renew at the promotional price or fail to grant paid access.
  if(coupon&&data.paymentMethod==='CREDIT_CARD')return Response.json({error:'Nesta etapa, cupons de desconto estão disponíveis apenas para Pix. Para pagar no cartão, remova o cupom.'},{status:400});
  // Production requires provider homologation and a separate go-live flag.
  if(data.paymentMethod==='CREDIT_CARD'&&!asaasCardCheckoutReady())
    return Response.json({error:'Cartão de crédito ainda está em homologação. Utilize Pix.'},{status:503});
  const id=crypto.randomUUID(),base=priceCents[plan],first=coupon?.price||base;
  try{
    await env.DB!.batch([
      env.DB!.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,coupon_id,coupon_code,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id,user.userId,plan,base,first,coupon?.coupon.id||null,coupon?.coupon.code||null,'creating',now),
      env.DB!.prepare("INSERT INTO asaas_order_consents(order_id,user_id,policy_version,payment_method,first_price_cents,renewal_price_cents,accepted_at) VALUES (?,?,?,?,?,?,?)")
        .bind(id,user.userId,'2026-11-15',data.paymentMethod,first,base,now)
    ]);
  }catch{return Response.json({error:'Já existe uma contratação em andamento ou o registro de consentimento está indisponível. Consulte sua assinatura.'},{status:409});}
  let unpersistedCardCheckout:string|null=null;
  try{
    if(coupon)await reserveCoupon(id,user.userId,coupon.coupon);
    if(data.paymentMethod==='CREDIT_CARD'){
      // Do not associate a pre-registered but incomplete Pix customer with this
      // Checkout. Asaas collects the payer's complete details on its own page.
      // customer_id is filled only from the authenticated CHECKOUT_PAID event.
      const body=hostedCardCheckoutPayload({
        orderId:id,plan,amountCents:first,
        nextDueDate:new Date(Date.now()+86400000).toISOString().slice(0,10)+' 12:00:00',
        siteOrigin:new URL(req.url).origin+'/'
      });
      const checkout=await asaasRequest<{id:string}>('/checkouts',{method:'POST',body});
      if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(checkout.id||''))
        throw Error('Asaas não retornou ID válido de checkout.');
      unpersistedCardCheckout=checkout.id;
      await env.DB!.batch([
        env.DB!.prepare("INSERT INTO asaas_card_checkouts(order_id,checkout_id,customer_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)")
          .bind(id,checkout.id,'','ACTIVE',now,now),
        env.DB!.prepare("UPDATE asaas_orders SET status='pending' WHERE id=? AND status='creating'").bind(id)
      ]);
      unpersistedCardCheckout=null;
      return Response.json({orderId:id,url:'https://asaas.com/checkoutSession/show?id='+encodeURIComponent(checkout.id),
        awaitingInvoice:false,mode:asaasConfig().mode,firstAmount:first/100,renewalAmount:base/100},
        {headers:{'Cache-Control':'no-store'}});
    }
    let customer=await env.DB!.prepare('SELECT customer_id FROM asaas_customers WHERE user_id=?').bind(user.userId).first<{customer_id:string}>();
    if(!customer){
      const list=await asaasRequest<{data:{id:string}[]}>('/customers?externalReference='+encodeURIComponent(user.userId));
      let customerId=list.data?.[0]?.id;
      if(!customerId){const remote=await asaasRequest<{id:string}>('/customers',{method:'POST',body:{name:data.name,cpfCnpj,email:user.email,externalReference:user.userId}});customerId=remote.id;}
      if(!customerId)throw Error('Cliente não localizado.');
      await env.DB!.prepare('INSERT INTO asaas_customers(user_id,customer_id,created_at) VALUES (?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(user.userId,customerId,now).run();
      customer={customer_id:customerId};
    }
    const sub=await asaasRequest<AsaasSubscription>('/subscriptions',{method:'POST',body:{
      customer:customer.customer_id,billingType:data.paymentMethod,value:first/100,
      nextDueDate:new Date().toISOString().slice(0,10),
      cycle:plan.endsWith('_year')?'YEARLY':'MONTHLY',externalReference:id,
      description:'MR: Meu Ritmo - '+plan,
      callback:{successUrl:new URL('/app?billing=awaiting_webhook',req.url).toString(),autoRedirect:false}
    }});
    if(!sub.id)throw Error('O Asaas não confirmou a assinatura.');
    await env.DB!.prepare("UPDATE asaas_orders SET provider_subscription_id=?,status='pending' WHERE id=?").bind(sub.id,id).run();
    const list=await asaasRequest<{data:AsaasPayment[]}>('/subscriptions/'+encodeURIComponent(sub.id)+'/payments?limit=10');
    const url=verifiedInvoice(list.data?.[0]?.invoiceUrl);
    return Response.json({orderId:id,url,awaitingInvoice:!url,mode:asaasConfig().mode,firstAmount:first/100,renewalAmount:base/100});
  }catch{
    // If Asaas created a Checkout but D1 could not persist its link, cancel it.
    // Never create a replacement subscription automatically after an uncertain write.
    if(unpersistedCardCheckout)
      await asaasRequest('/checkouts/'+encodeURIComponent(unpersistedCardCheckout)+'/cancel',{method:'POST'}).catch(()=>{});
    await env.DB!.prepare("UPDATE asaas_orders SET status='review' WHERE id=? AND status='creating'").bind(id).run();
    return Response.json({error:'A contratação precisa de conferência antes de uma nova tentativa. Nenhum plano foi liberado.',orderId:id},{status:503});
  }
}
