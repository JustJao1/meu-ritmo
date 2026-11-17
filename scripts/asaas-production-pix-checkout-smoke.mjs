// Asaas production readiness: create and immediately cancel an unpaid checkout.
// No customer, card details, payment or subscription is created.
const e=process.env;
if(e.ASAAS_MODE!=='production'||!e.ASAAS_API_KEY?.startsWith('$aact_prod_'))
 throw Error('Somente conta Asaas de produção é aceita.');
const base='https://api.asaas.com/v3';
async function call(path,method='GET',body){
 const res=await fetch(base+path,{method,headers:{access_token:e.ASAAS_API_KEY,
  accept:'application/json','Content-Type':'application/json',
  'User-Agent':'MeuRitmo-ProductionPix-Readiness/1.0'},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 const obj=await res.json().catch(()=>({}));
 return {ok:res.ok,http:res.status,obj};
}
const status=await call('/pix/addressKeys?limit=100');
if(!status.ok||!Array.isArray(status.obj.data))
 throw Error('Não foi possível validar chaves Pix de produção.');
const active=status.obj.data.filter(x=>x.status==='ACTIVE').length;
console.log('Chaves Pix ativas em produção: '+active);
if(!active)throw Error('A chave de produção não foi ativada; nenhuma cobrança será criada.');
const ref='mr_prod_readiness_'+crypto.randomUUID();
const host='https://meuritmo.net';
const created=await call('/checkouts','POST',{
 billingTypes:['PIX'],chargeTypes:['DETACHED'],minutesToExpire:30,
 externalReference:ref,
 items:[{name:'Teste Pix MR',description:'Validação técnica, não realizar pagamento',quantity:1,value:5.00}],
 callback:{successUrl:host+'/app?billing=awaiting_webhook',
 cancelUrl:host+'/app?billing=canceled',
 expiredUrl:host+'/app?billing=expired'}
});
console.log('Checkout Pix hospedado em produção: HTTP '+created.http);
if(!created.ok){
 const errors=(Array.isArray(created.obj.errors)?created.obj.errors:[]).slice(0,8);
 const messages=errors.map(x=>({
  code:String(x.code||'').replace(/[^A-Za-z0-9_]/g,'').slice(0,45),
  message:String(x.description||'').replace(/https?:\/\/\S+/g,'[URL]')
   .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email]')
   .replace(/\b\d{8,}\b/g,'[número]').slice(0,150)
 }));
 console.log('Erros de validação (sanitizados): '+JSON.stringify(messages));
 throw Error('Checkout de produção recusado. Venda pública deve continuar desativada.');
}
const id=created.obj.id;
if(typeof id!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
 throw Error('Checkout não retornou ID válido: cancelar manualmente no Asaas.');
const canceled=await call('/checkouts/'+encodeURIComponent(id)+'/cancel','POST');
console.log('Cancelamento imediato do checkout técnico: HTTP '+canceled.http);
if(!canceled.ok)throw Error('Checkout não pôde ser cancelado; revisar conta antes de liberar vendas.');
console.log('Checkout Pix da produção passou no teste de criação/cancelamento, sem pagamento.');
