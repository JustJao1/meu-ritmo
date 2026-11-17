import {env} from 'cloudflare:workers';
import {getUser} from '../../../session';
import {EARLY_ACCESS_ACTIVE} from '../../../../lib/entitlements';
import {asaasConfig,asaasCardCheckoutReady,asaasRequest,type AsaasSubscription,type AsaasPayment,type AsaasPlanCode} from '../../../../lib/asaas';
import {hostedCardCheckoutPayload} from '../../../../lib/asaas-hosted-card';
import {hostedPixCheckoutPayload,hostedCheckoutUrl} from '../../../../lib/asaas-hosted-pix';
import {priceCents,quoteCoupon,reserveCoupon} from '../../../../lib/asaas-coupons';
import {z} from 'zod';
import {validBrazilTaxId} from '../../../../lib/brazil-tax-id';
import {parseLegalSettings} from '../../../../lib/legal-settings';

const inputSchema=z.object({
  price:z.enum(['plus_month','plus_year','pro_month','pro_year']),
  paymentMethod:z.enum(['PIX','CREDIT_CARD']),
  name:z.string().trim().min(3).max(120),
  cpfCnpj:z.string().trim().min(11).max(18),
  discountCode:z.string().trim().max(32).optional(),
  acceptTerms:z.literal(true),
  acceptRefundPolicy:z.literal(true)
});
export async function POST(req:Request){
  if(EARLY_ACCESS_ACTIVE)return Response.json({error:'Assinaturas indisponíveis durante o acesso antecipado.'},{status:503});
  const user=await getUser();
  if(!user)return Response.json({error:'Entre na sua conta.'},{status:401});
  if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Origem inválida.'},{status:403});
  if(!asaasConfig().enabled)return Response.json({error:'Pagamento ainda não configurado.'},{status:503});
  const parsed=inputSchema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return Response.json({error:'Confira o plano, os dados do titular, os termos e a política de cancelamento e reembolso.'},{status:400});
  const data=parsed.data,cpfCnpj=data.cpfCnpj.replace(/\D/g,'');
  if(data.paymentMethod==='CREDIT_CARD'&&!asaasCardCheckoutReady())
    return Response.json({error:'Cartão de crédito indisponível até a homologação do provedor.'},{status:503});
  if(!validBrazilTaxId(cpfCnpj))return Response.json({error:'CPF ou CNPJ inválido. Confira os dígitos informados.'},{status:400});
  const now=Math.floor(Date.now()/1000);
  const legalRecord=await env.DB!.prepare("SELECT value FROM service_settings WHERE key='legal'").first<{value:string}>();
  if(!parseLegalSettings(legalRecord?.value))return Response.json({error:'Identificação comercial do fornecedor pendente ou inválida. Não é possível contratar neste momento.'},{status:503});
  const paid=await env.DB!.prepare('SELECT status,valid_until FROM subscriptions WHERE user_id=?').bind(user.userId).first<any>();
  if(paid&&['active','trialing'].includes(paid.status)&&(paid.valid_until||0)>now)return Response.json({error:'Você já possui uma assinatura ativa.'},{status:409});
  const plan=data.price as AsaasPlanCode;
  let coupon:Awaited<ReturnType<typeof quoteCoupon>>|null=null;
  try{if(data.discountCode)coupon=await quoteCoupon(plan,data.discountCode);}catch(e){return Response.json({error:(e as Error).message},{status:400});}
  const id=crypto.randomUUID(),base=priceCents[plan],first=coupon?.price||base;
  // Previous completed Pix periods must not prevent purchasing a new period.
  try{
    await env.DB!.batch([
      env.DB!.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,coupon_id,coupon_code,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id,user.userId,plan,base,first,coupon?.coupon.id||null,coupon?.coupon.code||null,'creating',now),
      env.DB!.prepare("INSERT INTO asaas_order_consents(order_id,user_id,policy_version,payment_method,first_price_cents,renewal_price_cents,accepted_at) VALUES (?,?,?,?,?,?,?)")
        .bind(id,user.userId,'2026-11-15',data.paymentMethod,first,base,now)
    ]);
  }catch{return Response.json({error:'Já existe uma contratação em andamento ou o registro de consentimento está indisponível. Consulte sua assinatura.'},{status:409});}
  try{
    if(coupon)await reserveCoupon(id,user.userId,coupon.coupon);
    let customer=await env.DB!.prepare('SELECT customer_id FROM asaas_customers WHERE user_id=?').bind(user.userId).first<{customer_id:string}>();
    if(!customer){
      const list=await asaasRequest<{data:{id:string}[]}>('/customers?externalReference='+encodeURIComponent(user.userId));
      let customerId=list.data?.[0]?.id;
      if(!customerId){const remote=await asaasRequest<{id:string}>('/customers',{method:'POST',body:{name:data.name,cpfCnpj,email:user.email,externalReference:user.userId}});customerId=remote.id;}
      if(!customerId)throw Error('Cliente não localizado.');
      await env.DB!.prepare('INSERT INTO asaas_customers(user_id,customer_id,created_at) VALUES (?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(user.userId,customerId,now).run();
      customer={customer_id:customerId};
    }
    if(data.paymentMethod==='PIX'){
      // Redirect to the actual Asaas Pix hosted checkout instead of relying on
      // the sandbox account's broken per-invoice dynamic Pix QR endpoint.
      const payload=hostedPixCheckoutPayload({
        orderId:id,customerId:customer.customer_id,plan,amountCents:first,
        siteOrigin:new URL(req.url).origin+'/'
      });
      const remote=await asaasRequest<{id:string}>('/checkouts',{method:'POST',body:payload});
      const url=hostedCheckoutUrl(remote.id);
      await env.DB!.batch([
        env.DB!.prepare("INSERT INTO asaas_hosted_pix_checkouts(order_id,checkout_id,customer_id,status,created_at,updated_at) VALUES (?,?,?,'ACTIVE',?,?)")
          .bind(id,remote.id,customer.customer_id,now,now),
        env.DB!.prepare("UPDATE asaas_orders SET status='pending' WHERE id=? AND status='creating'").bind(id)
      ]);
      return Response.json({orderId:id,method:'PIX',hosted:true,
        url,mode:asaasConfig().mode,firstAmount:first/100,
        renewalAmount:base/100,renewal:'manual'},
        {headers:{'Cache-Control':'no-store'}});
    }
    if(data.paymentMethod==='CREDIT_CARD'){
      // Card data stays entirely on the Asaas hosted payment form.
      const nextDueDate=new Date(Date.now()+600000).toISOString().slice(0,19).replace('T',' ');
      const payload=hostedCardCheckoutPayload({
        orderId:id,customerId:customer.customer_id,plan,amountCents:first,
        nextDueDate,siteOrigin:new URL(req.url).origin+'/'
      });
      const remote=await asaasRequest<{id:string}>('/checkouts',{method:'POST',body:payload});
      if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(remote.id||''))
        throw Error('Asaas não forneceu identificador válido do checkout.');
      await env.DB!.batch([
        env.DB!.prepare("INSERT INTO asaas_card_checkouts(order_id,checkout_id,customer_id,status,created_at,updated_at) VALUES (?,?,?,'ACTIVE',?,?)")
          .bind(id,remote.id,customer.customer_id,now,now),
        env.DB!.prepare("UPDATE asaas_orders SET status='pending' WHERE id=? AND status='creating'")
          .bind(id)
      ]);
      return Response.json({orderId:id,method:'CREDIT_CARD',
        url:'https://asaas.com/checkoutSession/show?id='+encodeURIComponent(remote.id),
        mode:asaasConfig().mode,firstAmount:first/100,renewalAmount:base/100},
        {headers:{'Cache-Control':'no-store'}});
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
    const invoice=list.data?.[0];
    // No hosted invoice URL is ever offered: the site displays only a verified
    // Pix QR Code and copy/paste code, even if Asaas defaults to boleto.
    if(invoice?.id){
      if(!/^pay_[a-zA-Z0-9_-]{1,90}$/.test(invoice.id)||Math.round(invoice.value*100)!==first||
        invoice.customer!==customer.customer_id||invoice.subscription!==sub.id)
        throw Error('Dados inconsistentes na fatura do Asaas.');
      if(invoice.billingType!=='PIX'){
        const converted=await asaasRequest<AsaasPayment>('/payments/'+encodeURIComponent(invoice.id),{
          method:'PUT',body:{billingType:'PIX',value:invoice.value,dueDate:invoice.dueDate}
        });
        if(converted.billingType!=='PIX'||converted.id!==invoice.id)
          throw Error('Asaas não confirmou Pix.');
      }
      try{
        const qr=await asaasRequest<{payload?:string;encodedImage?:string}>('/payments/'+encodeURIComponent(invoice.id)+'/pixQrCode');
        if(typeof qr.payload!=='string'||qr.payload.length<40||
          typeof qr.encodedImage!=='string'||qr.encodedImage.length<100)
          throw Error('QR Pix inválido.');
      }catch{
        // A pending QR may be retried without creating duplicate subscriptions.
        return Response.json({orderId:id,url:'/pagar?pedido='+encodeURIComponent(id),
          qrReady:false,awaitingInvoice:false,method:'PIX',mode:asaasConfig().mode,
          message:'O Asaas ainda não disponibilizou o QR Code Pix. Consulte esta cobrança novamente.'},
          {headers:{'Cache-Control':'no-store'}});
      }
    }
    const url='/pagar?pedido='+encodeURIComponent(id);
    return Response.json({orderId:id,url,method:'PIX',qrReady:!!invoice,awaitingInvoice:!invoice,mode:asaasConfig().mode,
      firstAmount:first/100,renewalAmount:base/100},{headers:{'Cache-Control':'no-store'}});

  }catch{
    await env.DB!.prepare("UPDATE asaas_orders SET status='review' WHERE id=? AND status='creating'").bind(id).run();
    return Response.json({error:'A contratação precisa de conferência antes de uma nova tentativa. Nenhum plano foi liberado.',orderId:id},{status:503});
  }
}
