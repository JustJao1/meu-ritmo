// One-time production diagnostic. Operates on one failed, unpaid order.
// Never prints customer/order identifiers, names, CPF, email, API keys or links.
// A synthetic R$5 Pix checkout is canceled immediately, without payment.
const e=process.env;
if(e.ASAAS_MODE!=='production'||!e.ASAAS_API_KEY?.startsWith('$aact_prod_'))
 throw Error('Somente ambiente de produção com chave correspondente.');
if(!e.CLOUDFLARE_ACCOUNT_ID||!e.CLOUDFLARE_API_TOKEN||
 !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(e.CLOUDFLARE_D1_DATABASE_ID||''))
 throw Error('Banco D1 não configurado.');
if(e.SANDBOX_D1_DATABASE_ID&&e.SANDBOX_D1_DATABASE_ID===e.CLOUDFLARE_D1_DATABASE_ID)
 throw Error('Não é permitido operar no banco Sandbox.');
if(new Date().toISOString().slice(0,10)!=='2026-11-18')
 throw Error('Diagnóstico de execução única fora da data prevista.');

const base='https://api.asaas.com/v3';
async function provider(path,method='GET',body){
 const res=await fetch(base+path,{method,headers:{
  'access_token':e.ASAAS_API_KEY,'Content-Type':'application/json',
  accept:'application/json','User-Agent':'MeuRitmo-Checkout-Diagnostic/1.0'},
  ...(body!==undefined?{body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(25000)});
 const data=await res.json().catch(()=>({}));
 const diagnostics=(Array.isArray(data.errors)?data.errors:[]).slice(0,4)
  .map(x=>({
    code:String(x.code||'unknown').replace(/[^a-zA-Z0-9_]/g,'').slice(0,55),
    description:String(x.description||'').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email]')
      .replace(/https?:\/\/\S+/g,'[url]')
      .replace(/\b\d{5,}\b/g,'[number]')
      .replace(/\$aact_\S+/g,'[key]')
      .replace(/[\r\n]/g,' ').slice(0,150)
  }));
 return {ok:res.ok,http:res.status,data,diagnostics};
}
const d1url='https://api.cloudflare.com/client/v4/accounts/'+
 encodeURIComponent(e.CLOUDFLARE_ACCOUNT_ID)+'/d1/database/'+
 encodeURIComponent(e.CLOUDFLARE_D1_DATABASE_ID)+'/query';
async function d1(sql,params=[]){
 const res=await fetch(d1url,{method:'POST',headers:{
  Authorization:'Bearer '+e.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},
  body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw Error('D1 indisponível HTTP '+res.status);
 const result=await res.json();
 if(!result.success||!result.result?.[0]?.success)throw Error('Consulta D1 não aprovada.');
 return result.result[0];
}
const all=await d1("SELECT o.id,o.created_at,o.first_price_cents,c.customer_id FROM asaas_orders o JOIN asaas_customers c ON c.user_id=o.user_id WHERE o.status='review' AND o.first_paid_at IS NULL AND o.provider_subscription_id IS NULL AND NOT EXISTS(SELECT 1 FROM asaas_hosted_pix_checkouts h WHERE h.order_id=o.id) AND NOT EXISTS(SELECT 1 FROM asaas_card_checkouts cc WHERE cc.order_id=o.id)");
if(all.results.length!==1){
 console.log('Pedidos elegíveis para diagnóstico: '+all.results.length+' (exige exatamente um). Nenhuma alteração.');
 process.exit(0);
}
const order=all.results[0],uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
if(!uuid.test(order.id)||!/^cus_[A-Za-z0-9_-]{5,90}$/.test(order.customer_id)||
 !Number.isInteger(order.first_price_cents)||order.first_price_cents<500)
 throw Error('Pedido ou cadastro inconsistente. Não houve alteração.');
console.log('Etapa 1: pedido em revisão e cadastro de cliente local confirmados.');
const cust=await provider('/customers/'+encodeURIComponent(order.customer_id));
console.log('Consulta ao cliente Asaas: HTTP '+cust.http);
if(!cust.ok)throw Error('Cadastro não encontrado ou não acessível no Asaas. Pedido preservado.');
let successCustomer=false,successCustomerData=false;
for(const variant of ['customer','customerData']){
 const data=variant==='customer'?{customer:order.customer_id}:{
  customerData:{
   name:cust.data.name,
   cpfCnpj:cust.data.cpfCnpj,
   ...(cust.data.email?{email:cust.data.email}:{})
  }
 };
 if(variant==='customerData'&&(!data.customerData?.name||!data.customerData?.cpfCnpj)){
  console.log('Pré-preenchimento indisponível: cadastro incompleto.');
  continue;
 }
 let checkoutId=null;
 const test=await provider('/checkouts','POST',{
  billingTypes:['PIX'],chargeTypes:['DETACHED'],minutesToExpire:10,
  ...data,
  externalReference:'mr_diag_'+crypto.randomUUID(),
  items:[{name:'Diagnóstico Pix Meu Ritmo',description:'Teste técnico, não pagar',quantity:1,value:5.00}],
  callback:{successUrl:'https://meuritmo.net/app?billing=awaiting_webhook',
   cancelUrl:'https://meuritmo.net/app?billing=canceled',
   expiredUrl:'https://meuritmo.net/app?billing=expired'}
 });
 console.log('Checkout com '+variant+': HTTP '+test.http+' / validação '+JSON.stringify(test.diagnostics));
 if(!test.ok)continue;
 if(!uuid.test(test.data.id||''))
  throw Error('Asaas não retornou checkout cancelável. Revisão manual obrigatória.');
 checkoutId=test.data.id;
 const canceled=await provider('/checkouts/'+encodeURIComponent(checkoutId)+'/cancel','POST');
 console.log('Cancelamento do teste '+variant+': HTTP '+canceled.http);
 if(!canceled.ok)throw Error('Checkout técnico não cancelado. Pedido original intocado.');
 if(variant==='customer')successCustomer=true;
 if(variant==='customerData')successCustomerData=true;
}
console.log('Resultado dos testes: com cliente='+successCustomer+', com preenchimento='+successCustomerData+'.');
// The failed checkout was never delivered to the payer: local lookup has no
// checkout ID or paid date. Check external references before releasing reserve.
if(Math.floor(Date.now()/1000)-Number(order.created_at)<90){
 console.log('Pedido recente demais para liberação automática; nenhuma alteração.');
 process.exit(0);
}
const [payments,subs]=await Promise.all([
 provider('/payments?externalReference='+encodeURIComponent(order.id)+'&limit=5'),
 provider('/subscriptions?externalReference='+encodeURIComponent(order.id)+'&limit=5')
]);
console.log('Conciliação do pedido antigo: pagamentos HTTP '+payments.http+', assinaturas HTTP '+subs.http);
if(!payments.ok||!subs.ok||!Array.isArray(payments.data.data)||!Array.isArray(subs.data.data))
 throw Error('Não foi possível confirmar ausência de cobrança. Pedido preservado.');
if(payments.data.data.length||subs.data.data.length)
 throw Error('Asaas encontrou cobrança ou assinatura anterior. Pedido preservado.');
const changed=await d1("UPDATE asaas_orders SET status='cancelled',cancelled_at=CAST(strftime('%s','now') AS INTEGER) WHERE id=? AND status='review' AND first_paid_at IS NULL AND provider_subscription_id IS NULL AND NOT EXISTS(SELECT 1 FROM asaas_hosted_pix_checkouts WHERE order_id=?) AND NOT EXISTS(SELECT 1 FROM asaas_card_checkouts WHERE order_id=?)",
 [order.id,order.id,order.id]);
if(Number(changed.meta?.changes||0)!==1)
 throw Error('Pedido não estava mais elegível; nenhum cupom foi alterado.');
await d1("DELETE FROM asaas_coupon_uses WHERE order_id=? AND EXISTS(SELECT 1 FROM asaas_orders WHERE id=? AND status='cancelled' AND first_paid_at IS NULL)",[order.id,order.id]);
console.log('Etapa 3: tentativa antiga sem pagamento encerrada e reserva do cupom liberada.');
