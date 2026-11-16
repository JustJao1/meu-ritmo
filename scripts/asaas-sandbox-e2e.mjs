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
 if(!res.ok)fail('Asaas '+method+' '+path.split('?')[0]+' retornou HTTP '+res.status);
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
   refundResult='indisponível por saldo ou regra de Sandbox; consultar Asaas';
  else throw error;
 }
 log('Estorno Pix Sandbox',refundResult);
 if(refundResult!=='reconciliado no Worker')
  console.warn('::warning title=Estorno do Asaas Sandbox pendente::O teste do estorno não concluiu. Não habilite cobranças reais antes de validar reembolso integral, parcial e conciliação.');
 log('RESULTADO',refundResult==='reconciliado no Worker'?'Pix, webhook, cancelamento e estorno homologados':'Pix, webhook e cancelamento homologados; estorno requer conferência');
}finally{
 // These records intentionally remain labelled in the isolated Sandbox D1:
 // later Asaas webhook redeliveries need the original order mapping to return 200.
 if(subscriptionId){
  try{await asaas('/subscriptions/'+encodeURIComponent(subscriptionId),'DELETE')}catch{}
 }
 log('Escopo do teste','somente Asaas e D1 Sandbox; produção não utilizada');
}
