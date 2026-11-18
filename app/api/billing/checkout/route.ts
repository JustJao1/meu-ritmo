import {env} from 'cloudflare:workers';
import {getUser} from '../../../session';
import {EARLY_ACCESS_ACTIVE} from '../../../../lib/entitlements';
import {AsaasApiError,asaasConfig,asaasCardCheckoutReady,asaasRequest,type AsaasSubscription,type AsaasPayment,type AsaasPlanCode} from '../../../../lib/asaas';
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
  phone:z.string().trim().min(10).max(20),
  postalCode:z.string().trim().min(8).max(10),
  address:z.string().trim().min(4).max(150),
  addressNumber:z.string().trim().min(1).max(20),
  province:z.string().trim().min(2).max(70),
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
  const phone=data.phone.replace(/\D/g,''),postalCode=data.postalCode.replace(/\D/g,'');
  if(!/^\d{10,11}$/.test(phone)||!/^\d{8}$/.test(postalCode)||!/[\p{L}]{3,}/u.test(data.address))
    return Response.json({error:'Confira telefone com DDD, CEP e endereço completo.'},{status:400});
  if(!/[\p{L}\d]/u.test(data.addressNumber)||!/[\p{L}]{2,}/u.test(data.province))
    return Response.json({error:'Informe o número do endereço e o bairro.'},{status:400});
  const customerDetails={
    name:data.name,cpfCnpj,
    phone,mobilePhone:phone.length===11?phone:undefined,
    postalCode,address:data.address,addressNumber:data.addressNumber,
    province:data.province
  };
  if(data.paymentMethod==='CREDIT_CARD'&&!asaasCardCheckoutReady())
    return Response.json({error:'Cartão de crédito indisponível até a homologação do provedor.'},{status:503});
  if(!validBrazilTaxId(cpfCnpj))return Response.json({error:'CPF ou CNPJ inválido. Confira os dígitos informados.'},{status:400});
  const now=Math.floor(Date.now()/1000);
  const legalRecord=await env.DB!.prepare("SELECT value FROM service_settings WHERE key='legal'").first<{value:string}>();
  if(!parseLegalSettings(legalRecord?.value))return Response.json({error:'Identificação comercial do fornecedor pendente ou inválida. Não é possível contratar neste momento.'},{status:503});
  const paid=await env.DB!.prepare('SELECT status,valid_until FROM subscriptions WHERE user_id=?').bind(user.userId).first<any>();
  if(paid&&['active','trialing'].includes(paid.status)&&(paid.valid_until||0)>now)return Response.json({error:'Você já possui uma assinatura ativa.'},{status:409});
  // Reuse the same pending Pix checkout instead of creating duplicate charges.
  // A different plan, an expired checkout or a review must be resolved first.
  const openOrder=await env.DB!.prepare(
    "SELECT o.id,o.plan_code,o.coupon_code,o.first_price_cents,o.status,o.created_at,h.checkout_id,h.status AS checkout_status "+
    "FROM asaas_orders o LEFT JOIN asaas_hosted_pix_checkouts h ON h.order_id=o.id "+
    "WHERE o.user_id=? AND o.status IN ('creating','pending','review') ORDER BY o.created_at DESC LIMIT 1"
  ).bind(user.userId).first<{
    id:string;plan_code:string;coupon_code:string|null;first_price_cents:number;status:string;
    created_at:number;checkout_id:string|null;checkout_status:string|null
  }>();
  if(openOrder){
    const samePrice=openOrder.plan_code===data.price;
    const sameCoupon=(openOrder.coupon_code||'')===(data.discountCode||'').trim().toUpperCase();
    if(data.paymentMethod==='PIX'&&openOrder.status==='pending'&&
      openOrder.checkout_status==='ACTIVE'&&openOrder.checkout_id&&
      now-openOrder.created_at<3000&&samePrice&&sameCoupon){
      try{
        return Response.json({orderId:openOrder.id,method:'PIX',hosted:true,
          resumed:true,url:hostedCheckoutUrl(openOrder.checkout_id),
          mode:asaasConfig().mode,firstAmount:openOrder.first_price_cents/100,
          renewal:'manual'}, {headers:{'Cache-Control':'no-store'}});
      }catch{ /* Invalid checkout IDs must not be sent to a customer. */ }
    }
    return Response.json({error:openOrder.status==='review'?
      'Há uma contratação em revisão. Consulte o painel de cobranças antes de tentar novamente.':
      'Há um checkout anterior em andamento. Consulte a fatura ou cancele o Pix pendente antes de iniciar outra compra.',
      action:'existing_order',orderId:openOrder.id},{status:409,headers:{'Cache-Control':'no-store'}});
  }
  const plan=data.price as AsaasPlanCode;
  let coupon:Awaited<ReturnType<typeof quoteCoupon>>|null=null;
  try{if(data.discountCode)coupon=await quoteCoupon(plan,data.discountCode,user.userId);}catch(e){return Response.json({error:(e as Error).message},{status:400});}
  const id=crypto.randomUUID(),base=priceCents[plan],first=coupon?.price||base;
  if(data.paymentMethod==='PIX'&&first<500)
    return Response.json({error:'O checkout Pix do Asaas exige pelo menos R$ 5,00. Ajuste o cupom de desconto.'},{status:400});
  // Previous completed Pix periods must not prevent purchasing a new period.
  try{
    await env.DB!.prepare("UPDATE asaas_orders SET status='expired' WHERE user_id=? AND status='active' AND first_paid_at IS NOT NULL AND EXISTS (SELECT 1 FROM asaas_hosted_pix_checkouts h WHERE h.order_id=asaas_orders.id AND h.status='PAID') AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id=asaas_orders.user_id AND s.status='active' AND s.valid_until>?)").bind(user.userId,now).run();
    await env.DB!.batch([
      env.DB!.prepare("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,coupon_id,coupon_code,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id,user.userId,plan,base,first,coupon?.coupon.id||null,coupon?.coupon.code||null,'creating',now),
      env.DB!.prepare("INSERT INTO asaas_order_consents(order_id,user_id,policy_version,payment_method,first_price_cents,renewal_price_cents,accepted_at) VALUES (?,?,?,?,?,?,?)")
        .bind(id,user.userId,'2026-11-15',data.paymentMethod,first,base,now)
    ]);
  }catch{return Response.json({error:'Já existe uma contratação em andamento ou o registro de consentimento está indisponível. Consulte sua assinatura.'},{status:409});}
  let stage='coupon_reservation';
  try{
    if(coupon)await reserveCoupon(id,user.userId,coupon.coupon);
    stage='customer_local';
    let customer=await env.DB!.prepare('SELECT customer_id FROM asaas_customers WHERE user_id=?').bind(user.userId).first<{customer_id:string}>();
    if(!customer){
      stage='customer_lookup';
      const list=await asaasRequest<{data:{id:string}[]}>('/customers?externalReference='+encodeURIComponent(user.userId));
      let customerId=list.data?.[0]?.id;
      if(!customerId){stage='customer_create';const remote=await asaasRequest<{id:string}>('/customers',{method:'POST',body:{...customerDetails,email:user.email,externalReference:user.userId}});customerId=remote.id;}
      if(!customerId)throw Error('Cliente não localizado.');
      stage='customer_store';
      await env.DB!.prepare('INSERT INTO asaas_customers(user_id,customer_id,created_at) VALUES (?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(user.userId,customerId,now).run();
      customer={customer_id:customerId};
    }
    // The hosted Asaas checkout requires a complete, up-to-date customer record.
    // Keep the same customer ID to preserve verified payment/customer matching.
    stage='customer_update';
    await asaasRequest('/customers/'+encodeURIComponent(customer.customer_id),{
      method:'PUT',body:customerDetails
    });
    if(data.paymentMethod==='PIX'){
      // Redirect to the actual Asaas Pix hosted checkout instead of relying on
      // the sandbox account's broken per-invoice dynamic Pix QR endpoint.
      stage='checkout_payload';
      const payload=hostedPixCheckoutPayload({
        orderId:id,customerId:customer.customer_id,plan,amountCents:first,
        siteOrigin:new URL(req.url).origin+'/'
      });
      stage='checkout_create';
      const remote=await asaasRequest<{id:string}>('/checkouts',{method:'POST',body:payload});
      stage='checkout_record';
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
      stage='card_checkout_payload';
      // Card data stays entirely on the Asaas hosted payment form.
      const nextDueDate=new Date(Date.now()+600000).toISOString().slice(0,19).replace('T',' ');
      const payload=hostedCardCheckoutPayload({
        orderId:id,customerId:customer.customer_id,plan,amountCents:first,
        nextDueDate,siteOrigin:new URL(req.url).origin+'/'
      });
      stage='card_checkout_create';
      const remote=await asaasRequest<{id:string}>('/checkouts',{method:'POST',body:payload});
      stage='card_checkout_record';
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
      description:'Meu Ritmo - '+plan,
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

  }catch(error){
    const httpStatus=error instanceof AsaasApiError?error.status:null;
    // Before POST /checkouts no checkout exists. A definite 4xx rejection
    // also guarantees the checkout was not created. Timeouts and 5xx are
    // ambiguous: never release a coupon or create another checkout blindly.
    const rejectedCheckout=['checkout_create','card_checkout_create'].includes(stage)&&
      httpStatus!==null&&[400,401,403,404,422].includes(httpStatus);
    const beforeCheckout=!['checkout_create','checkout_record','card_checkout_create','card_checkout_record'].includes(stage);
    const safeToRelease=beforeCheckout||rejectedCheckout;
    const time=Math.floor(Date.now()/1000);
    console.warn('Asaas checkout failure',JSON.stringify({
      stage,httpStatus,release:safeToRelease,provider:'asaas'
    }));
    // Persist only operational classification; no name, document, email or keys.
    try{
      await env.DB!.prepare(
        'INSERT INTO asaas_checkout_failures(order_id,stage,provider_http_status,failed_at) VALUES (?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET stage=excluded.stage,provider_http_status=excluded.provider_http_status,failed_at=excluded.failed_at'
      ).bind(id,stage,httpStatus,time).run();
    }catch{ console.warn('Asaas checkout diagnostic storage unavailable'); }
    if(safeToRelease){
      await env.DB!.batch([
        env.DB!.prepare("UPDATE asaas_orders SET status='cancelled',cancelled_at=? WHERE id=? AND status='creating' AND first_paid_at IS NULL")
          .bind(time,id),
        env.DB!.prepare("DELETE FROM asaas_coupon_uses WHERE order_id=? AND EXISTS(SELECT 1 FROM asaas_orders WHERE id=? AND status='cancelled' AND first_paid_at IS NULL)")
          .bind(id,id)
      ]);
      return Response.json({error:stage==='checkout_create'?
        'O Asaas recusou a criação do Pix. Nenhuma cobrança foi concluída e o cupom foi liberado. Confira os dados e tente novamente.':
        'Não foi possível preparar o pagamento. Nenhuma cobrança foi criada e o cupom foi liberado. Tente novamente.',
        stage:stage==='checkout_create'?'asaas_checkout':'payer_setup',
        providerHttpStatus:httpStatus}, {status:502,headers:{'Cache-Control':'no-store'}});
    }
    await env.DB!.prepare("UPDATE asaas_orders SET status='review' WHERE id=? AND status='creating'").bind(id).run();
    return Response.json({error:'Não foi possível confirmar se o Asaas criou o Pix. A tentativa ficou em revisão para evitar uma cobrança duplicada. Nenhum plano foi liberado.',
      stage:'asaas_checkout_review',providerHttpStatus:httpStatus,orderId:id},
      {status:503,headers:{'Cache-Control':'no-store'}});
  }
}
