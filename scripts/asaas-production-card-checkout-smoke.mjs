// Card hosted Checkout readiness without handling a card or charging anyone.
const env=process.env;
if(env.ASAAS_MODE!=='production'||!env.ASAAS_API_KEY?.startsWith('$aact_prod_'))
 throw Error('Este teste exige o ambiente Asaas de produção.');
const base='https://api.asaas.com/v3';
async function call(path,method='GET',body){
 const r=await fetch(base+path,{method,headers:{access_token:env.ASAAS_API_KEY,
  accept:'application/json','Content-Type':'application/json','User-Agent':'MeuRitmo-CardCheckout-Readiness/1.0'},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 return {ok:r.ok,http:r.status,data:await r.json().catch(()=>({}))};
}
const origin='https://meuritmo.net';
const reference='mr_prod_card_readiness_'+crypto.randomUUID();
const nextDueDate=new Date(Date.now()+3*3600000).toISOString().slice(0,19).replace('T',' ');
const checkout=await call('/checkouts','POST',{
 billingTypes:['CREDIT_CARD'],chargeTypes:['RECURRENT'],minutesToExpire:30,
 externalReference:reference,
 items:[{name:'Teste Cartao MR',description:'Teste de integração. Não informar cartão.',quantity:1,value:5.00}],
 subscription:{cycle:'MONTHLY',nextDueDate},
 callback:{successUrl:origin+'/app?billing=awaiting_webhook',
  cancelUrl:origin+'/app?billing=canceled',expiredUrl:origin+'/app?billing=expired'}
});
console.log('Checkout recorrente de cartão, sem informar cartão: HTTP '+checkout.http);
if(!checkout.ok){
 const errs=Array.isArray(checkout.data.errors)?checkout.data.errors:[];
 console.log('Validações do Asaas: '+JSON.stringify(errs.slice(0,5).map(x=>({
  code:String(x.code||'').slice(0,40),
  message:String(x.description||'').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email]')
  .replace(/https?:\/\/\S+/g,'[url]').replace(/\b\d{8,}\b/g,'[número]').slice(0,140)
 }))));
 throw Error('Checkout de cartão ainda não está disponível neste formato.');
}
const id=checkout.data.id;
if(typeof id!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
 throw Error('Checkout criado sem ID válido; cancelar no painel do Asaas.');
const canceled=await call('/checkouts/'+encodeURIComponent(id)+'/cancel','POST');
console.log('Cancelamento do checkout de cartão: HTTP '+canceled.http);
if(!canceled.ok)throw Error('Checkout não foi cancelado; revisar no painel antes de liberar vendas.');
console.log('Criação e cancelamento de Checkout de cartão aprovados; nenhum dado de cartão foi informado.');
