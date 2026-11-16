// Real, sandbox-only Asaas integration test.
// All payer data is synthetic and notifications are disabled. No production access.
import {randomUUID} from 'node:crypto';

const base='https://api-sandbox.asaas.com/v3';
const worker='https://meu-ritmo-asaas-sandbox.silva-joao-232334.workers.dev';
const e=process.env;
function fail(message){throw Error(message)}
const log=(label,value)=>console.log(label+': '+value);
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
if(e.ASAAS_MODE!=='sandbox'||!e.ASAAS_API_KEY?.startsWith('$aact_hmlg_'))fail('Chave e modo Sandbox inválidos.');
if(!uuid.test(e.SANDBOX_D1_DATABASE_ID||'')||
 !uuid.test(e.PRODUCTION_D1_DATABASE_ID||'')||
 e.SANDBOX_D1_DATABASE_ID===e.PRODUCTION_D1_DATABASE_ID)
 fail('D1 de homologação ausente ou compartilhado com produção.');
if(!e.CLOUDFLARE_ACCOUNT_ID||!e.CLOUDFLARE_API_TOKEN)fail('Acesso D1 de homologação ausente.');
if(!e.SANDBOX_ASAAS_WEBHOOK_TOKEN||e.SANDBOX_ASAAS_WEBHOOK_TOKEN.length<32)
 fail('Token de webhook de homologação ausente.');
const cfBase='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(e.CLOUDFLARE_ACCOUNT_ID)+'/d1/database/'+encodeURIComponent(e.SANDBOX_D1_DATABASE_ID);
async function asaas(path,method='GET',body){
 const res=await fetch(base+path,{
  method,headers:{access_token:e.ASAAS_API_KEY,Accept:'application/json','Content-Type':'application/json','User-Agent':'MeuRitmo-Sandbox-E2E/1.0'},
  ...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)
 });
 const data=await res.json().catch(()=>({}));
 if(!res.ok){
  // Print only provider validation codes and a redacted description.
  // Never print request payloads, payer identifiers, account data or API keys.
  if((path==='/checkouts'||path.endsWith('/refund'))&&Array.isArray(data.errors)){
   const safe=data.errors.slice(0,4).map(item=>{
    const code=String(item.code||'').replace(/[^a-zA-Z0-9_]/g,'').slice(0,50);
    const description=String(item.description||'').replace(/\b\d{11,14}\b/g,'[identificador]')
     .replace(/\b(cus_|pay_|sub_)[a-zA-Z0-9_-]+/g,'[identificador]')
     .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,'[email]')
     .slice(0,170);
    return {code,description};
   });
   console.error('Diagnóstico da API Asaas Sandbox:',JSON.stringify(safe));
  }
  fail('Asaas '+method+' '+path.split('?')[0]+' retornou HTTP '+res.status);
 }
 return data;
}
async function cf(path,method='GET',body){
 const res=await fetch(cfBase+path,{
  method,headers:{Authorization:'Bearer '+e.CLOUDFLARE_API_TOKEN,Accept:'application/json','Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)
 });
 const data=await res.json().catch(()=>({}));
 if(!res.ok||data.success===false)fail('Cloudflare D1 '+path+' retornou erro ou recusou a consulta.');
 return data;
}
async function query(sql,params=[]){
 const data=await cf('/query','POST',{sql,params});
 const result=data.result?.[0];
 if(!result?.success)fail('Consulta no D1 de homologação não foi concluída.');
 return result.results||[];
}
async function webhook(eventId,paymentId,event='PAYMENT_RECEIVED'){
 const response=await fetch(worker+'/api/billing/webhook/asaas',{
  method:'POST',headers:{'asaas-access-token':e.SANDBOX_ASAAS_WEBHOOK_TOKEN,'Content-Type':'application/json'},
  body:JSON.stringify({id:eventId,event,payment:{id:paymentId}}),signal:AbortSignal.timeout(20000)
 });
 if(!response.ok)fail('Webhook do Worker Sandbox retornou HTTP '+response.status);
 return response;
}
const database=await cf('');
if(database.result?.name!=='meu-ritmo-asaas-sandbox')
 fail('D1 não pertence ao Worker de homologação. Nenhuma transação foi criada.');
const statusRes=await fetch(worker+'/api/billing/status',{signal:AbortSignal.timeout(15000)});
if(!statusRes.ok)fail('Worker Sandbox não está disponível.');
const status=await statusRes.json();
if(status.mode!=='sandbox'||status.provider!=='asaas'||status.manageAvailable!==true)
 fail('Worker Sandbox não corresponde à integração Asaas configurada.');
log('Banco isolado validado','OK');
log('Ambiente Worker e API Asaas','sandbox');

const userId='mr_homolog_'+randomUUID();
const orderId=randomUUID();
const eventId='evt_mr_homolog_'+randomUUID();
const now=Math.floor(Date.now()/1000);
let subscriptionId=null;
let paymentId=null;
let refundResult='não iniciado';
let standalonePixId=null;
let reachedWebhook=false;
try{
 // Asaas documentation provides this artificial validation CPF. Never use a real user.
 const customer=await asaas('/customers','POST',{
  name:'Meu Ritmo Homologacao Sandbox',cpfCnpj:'24971563792',
  externalReference:userId,notificationDisabled:true
 });
 if(!/^cus_[A-Za-z0-9]+$/.test(customer.id||''))fail('Cadastro do pagador fictício não retornou ID.');
 await query('INSERT INTO asaas_customers(user_id,customer_id,created_at) VALUES (?,?,?)',
  [userId,customer.id,now]);
 log('Cliente fictício Asaas','criado, notificações desabilitadas');

 const today=new Date().toISOString().slice(0,10);
 const subscription=await asaas('/subscriptions','POST',{
  customer:customer.id,billingType:'PIX',value:19.90,cycle:'MONTHLY',
  nextDueDate:today,externalReference:orderId,
  description:'MR Meu Ritmo homologacao exclusiva sandbox'
 });
 if(!/^sub_[A-Za-z0-9_-]{1,90}$/.test(subscription.id||''))fail('Assinatura Pix de teste sem ID.');
 subscriptionId=subscription.id;
 await query("INSERT INTO asaas_orders(id,user_id,provider_subscription_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
 [orderId,userId,subscriptionId,'plus_month',1990,1990,'pending',now]);
 log('Assinatura recorrente Pix','criada no Asaas Sandbox');

 let payment=null;
 for(let attempt=0;attempt<12;attempt++){
  const list=await asaas('/subscriptions/'+encodeURIComponent(subscriptionId)+'/payments?limit=10');
  payment=Array.isArray(list.data)?list.data[0]:null;
  if(payment)break;
  await new Promise(resolve=>setTimeout(resolve,1250));
 }
 if(payment?.id)log('Identificador sintético de fatura',String(payment.id));
 if(!payment?.id||!/^pay_[A-Za-z0-9_-]{1,90}$/.test(payment.id))
  fail('Assinatura não gerou uma fatura Pix testável; resposta não seguiu o identificador esperado.');
 paymentId=payment.id;
 const before=await asaas('/payments/'+encodeURIComponent(paymentId));
 if(['CONFIRMED','RECEIVED'].includes(before.status))
  fail('Pagamento artificial começou como recebido antes da confirmação.');
 log('Fatura inicial antes da confirmação','sem liberação indevida');

 const confirmed=await asaas('/sandbox/payment/'+encodeURIComponent(paymentId)+'/confirm','POST',{});
 if(!['CONFIRMED','RECEIVED'].includes(confirmed.status))
  fail('Sandbox não confirmou o pagamento simulado.');
 const check=await asaas('/payments/'+encodeURIComponent(paymentId));
 log('Forma da cobrança simulada no Asaas',String(check.billingType||'não informada'));
 if(!['CONFIRMED','RECEIVED'].includes(check.status))
  fail('Consulta de pagamento não refletiu a confirmação simulada.');
 log('Pagamento simulado confirmado','OK; nenhum dinheiro real');

 await webhook(eventId,paymentId,'PAYMENT_RECEIVED');
 reachedWebhook=true;
 const rows=await query('SELECT plan,status,valid_until,subscription_id FROM subscriptions WHERE user_id=?',[userId]);
 const granted=rows[0];
 if(granted?.plan!=='plus'||granted.status!=='active'||granted.valid_until<=now||granted.subscription_id!==subscriptionId)
  fail('Webhook não liberou Plus corretamente no D1 de homologação.');
 log('Webhook autenticado e plano Plus','confirmados no D1 Sandbox');

 await webhook(eventId,paymentId,'PAYMENT_RECEIVED');
 const counted=await query('SELECT count(*) AS n FROM asaas_webhook_events WHERE event_id=?',[eventId]);
 if(Number(counted[0]?.n)!==1)fail('Webhook duplicado não foi idempotente.');
 log('Reenvio do mesmo webhook','idempotência aprovada');

 const invalid=await fetch(worker+'/api/billing/webhook/asaas',{
  method:'POST',headers:{'asaas-access-token':'token-invalido','Content-Type':'application/json'},
  body:JSON.stringify({id:'evt_invalido_'+randomUUID(),event:'PAYMENT_RECEIVED',payment:{id:paymentId}}),
  signal:AbortSignal.timeout(12000)
 });
 if(invalid.status!==401)fail('Webhook aceitou um token inválido.');
 log('Webhook com autenticação incorreta','HTTP 401');

 // Cancel only this synthetic subscription. A paid period is intentionally kept.
 await asaas('/subscriptions/'+encodeURIComponent(subscriptionId),'DELETE');
 await query("UPDATE asaas_orders SET status='cancelled',cancelled_at=? WHERE id=?",[Math.floor(Date.now()/1000),orderId]);
 const afterCancel=await query('SELECT status,valid_until FROM subscriptions WHERE user_id=?',[userId]);
 if(afterCancel[0]?.status!=='active'||afterCancel[0]?.valid_until<=now)
  fail('Cancelamento perdeu o período já pago.');
 log('Cancelamento e preservação do período pago','OK');

 // Give the isolated Sandbox balance room for Pix fees. A full refund returns
 // the gross amount while the payment net amount excludes non-refundable fees.
 // This synthetic charge has no connection to user subscriptions or real money.
 try{
  const credit=await asaas('/payments','POST',{
   customer:customer.id,billingType:'PIX',value:10.00,dueDate:new Date().toISOString().slice(0,10),
   description:'Saldo ficticio para estorno de homologacao',externalReference:'mr_sandbox_balance_'+randomUUID()
  });
  if(!/^pay_[A-Za-z0-9_-]{1,90}$/.test(credit.id||''))fail('Cobrança de saldo fictício sem ID válido.');
  const funded=await asaas('/sandbox/payment/'+encodeURIComponent(credit.id)+'/confirm','POST',{});
  if(!['CONFIRMED','RECEIVED'].includes(funded.status))fail('Saldo fictício não pôde ser confirmado.');
  standalonePixId=credit.id;
  const creditState=await asaas('/payments/'+encodeURIComponent(credit.id));
  log('Forma da cobrança Pix avulsa',String(creditState.billingType||'não informada'));
  log('Saldo de teste para o estorno','adicionado apenas ao Asaas Sandbox');
 }catch(error){
  console.warn('::warning title=Saldo fictício para teste::O reforço de saldo da conta Sandbox não foi confirmado.');
 }
 // Refund is attempted on the isolated charge. Sandbox may reject if balance is
 // insufficient for fees; such a result is reported as pending instead of claiming success.
 try{
  await asaas('/payments/'+encodeURIComponent(paymentId)+'/refund','POST',{description:'Estorno exclusivamente de homologacao'});
  refundResult='aceito pelo Asaas';
  // Always fetch the authoritative payment status before updating D1.
  const refunded=await asaas('/payments/'+encodeURIComponent(paymentId));
  if(['REFUNDED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','DELETED','PARTIALLY_REFUNDED','REFUND_IN_PROGRESS'].includes(refunded.status)){
   await webhook('evt_mr_refund_'+randomUUID(),paymentId,'PAYMENT_REFUNDED');
   const after=await query('SELECT status,valid_until FROM subscriptions WHERE user_id=?',[userId]);
   if(refunded.status==='REFUNDED'&&(after[0]?.status!=='canceled'||Number(after[0].valid_until)!==0))
    fail('O estorno integral não revogou o benefício testado.');
   refundResult='reconciliado no Worker';
  }else{
   refundResult='solicitado; confirmação do estorno ainda pendente';
  }
 }catch(error){
  if(/Asaas POST .*\/refund retornou HTTP 400/.test(error.message))
   refundResult='não homologado: cobrança classificada como '+String(check.billingType||'não informada')+' pelo Asaas Sandbox';
  else throw error;
 }
 log('Estorno da fatura recorrente',refundResult);
 // Separately validate refund of a genuine PIX charge. A recurring invoice
 // reported as BOLETO cannot be treated as a PIX refund just because the
 // underlying subscription was originally requested with billingType PIX.
 if(standalonePixId){
  const separate=await asaas('/payments/'+encodeURIComponent(standalonePixId));
  if(separate.billingType==='PIX'){
   try{
    await asaas('/payments/'+encodeURIComponent(standalonePixId)+'/refund','POST',{description:'Estorno Pix avulso apenas para homologacao'});
    const result=await asaas('/payments/'+encodeURIComponent(standalonePixId));
    log('Estorno Pix avulso Sandbox',String(result.status));
   }catch(error){
    log('Estorno Pix avulso Sandbox','recusado pela API; requer conferência');
   }
  }else{
   log('Estorno Pix avulso Sandbox','não homologado: cobrança retornou '+String(separate.billingType||'sem tipo'));
  }
 }
 if(refundResult!=='reconciliado no Worker')
  console.warn('::warning title=Estorno do Asaas Sandbox pendente::O teste do estorno não concluiu. Não habilite cobranças reais antes de validar reembolso integral, parcial e conciliação.');
 log('RESULTADO',refundResult==='reconciliado no Worker'?'Assinatura, webhook, cancelamento e estorno homologados':'Assinatura simulada, webhook e cancelamento homologados; cobrança inicial é boleto e estorno recorrente requer conferência');
 
 // Test the hosted recurring card Checkout with a synthetic payer, without
 // providing a card number or completing a card payment. Only Sandbox.
 const cardOrderId=randomUUID();
 const currentPlan=await query('SELECT plan,status,valid_until FROM subscriptions WHERE user_id=?',[userId]);
 const beforeCard=JSON.stringify(currentPlan);
 let hostedCheckoutId=null;
 try{
  const date=new Date(Date.now()+86400000).toISOString().slice(0,10)+' 12:00:00';
  const checkout=await asaas('/checkouts','POST',{
   billingTypes:['CREDIT_CARD'],chargeTypes:['RECURRENT'],
   minutesToExpire:10,externalReference:cardOrderId,
   callback:{
    successUrl:worker+'/app?billing=awaiting_webhook',
    cancelUrl:worker+'/app?billing=canceled',
    expiredUrl:worker+'/app?billing=expired'
   },
   items:[{name:'MR: Meu Ritmo Pro',description:'Teste de assinatura mensal no Sandbox',quantity:1,value:29.90}],
   subscription:{cycle:'MONTHLY',nextDueDate:date}
  });
  if(!uuid.test(checkout?.id||''))fail('Checkout de cartão não retornou ID válido.');
  hostedCheckoutId=checkout.id;
  const cardNow=Math.floor(Date.now()/1000);
  await query("INSERT INTO asaas_orders(id,user_id,plan_code,base_price_cents,first_price_cents,status,created_at) VALUES (?,?,?,?,?,?,?)",
   [cardOrderId,userId,'pro_month',2990,2990,'pending',cardNow]);
  await query("INSERT INTO asaas_card_checkouts(order_id,checkout_id,customer_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)",
   [cardOrderId,hostedCheckoutId,'','ACTIVE',cardNow,cardNow]);
  log('Checkout recorrente hospedado de cartão','criado no Asaas Sandbox sem dados de cartão');
  const sendCardEvent=async(eventName,status)=>{
   const response=await fetch(worker+'/api/billing/webhook/asaas',{
    method:'POST',
    headers:{'asaas-access-token':e.SANDBOX_ASAAS_WEBHOOK_TOKEN,'Content-Type':'application/json'},
    body:JSON.stringify({id:'evt_mr_card_'+randomUUID(),event:eventName,
     checkout:{id:hostedCheckoutId,customer:null,status,billingTypes:['CREDIT_CARD'],chargeTypes:['RECURRENT']}}),
    signal:AbortSignal.timeout(20000)
   });
   if(!response.ok)fail('Webhook de checkout '+eventName+' retornou HTTP '+response.status);
  };
  await sendCardEvent('CHECKOUT_CREATED','ACTIVE');
  await asaas('/checkouts/'+encodeURIComponent(hostedCheckoutId)+'/cancel','POST');
  await sendCardEvent('CHECKOUT_CANCELED','CANCELED');
  const states=await query('SELECT status FROM asaas_card_checkouts WHERE checkout_id=?',[hostedCheckoutId]);
  const orderState=await query('SELECT status,provider_subscription_id FROM asaas_orders WHERE id=?',[cardOrderId]);
  if(states[0]?.status!=='CANCELED'||orderState[0]?.status!=='cancelled'||orderState[0]?.provider_subscription_id)
   fail('Cancelamento do checkout de cartão não conciliou D1 corretamente.');
  const afterCard=await query('SELECT plan,status,valid_until FROM subscriptions WHERE user_id=?',[userId]);
  if(JSON.stringify(afterCard)!==beforeCard)fail('Checkout sem pagamento alterou indevidamente o plano do usuário.');
  log('Checkout de cartão e cancelamento','homologados sem cobrança, plano preservado');
 }finally{
  if(hostedCheckoutId){
   try{await asaas('/checkouts/'+encodeURIComponent(hostedCheckoutId)+'/cancel','POST')}catch{}
  }
 }

}finally{
 // These records intentionally remain labelled in the isolated Sandbox D1:
 // later Asaas webhook redeliveries need the original order mapping to return 200.
 if(subscriptionId){
  try{await asaas('/subscriptions/'+encodeURIComponent(subscriptionId),'DELETE')}catch{}
 }
 log('Escopo do teste','somente Asaas e D1 Sandbox; produção não utilizada');
}
