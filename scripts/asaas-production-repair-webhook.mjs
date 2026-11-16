// Ajusta exclusivamente a lista de eventos do webhook EXISTENTE de produção.
// Não cria pagamentos, não altera token, URL, fila ou outros campos.
// Só funciona enquanto novas cobranças estiverem desativadas.
const e=process.env;
const base='https://api.asaas.com/v3';
const dest='https://meuritmo.net/api/billing/webhook/asaas';
const required=['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_REFUNDED','PAYMENT_UPDATED',
 'CHECKOUT_CREATED','CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','SUBSCRIPTION_CREATED'];
if(e.ASAAS_MODE!=='production'||!e.ASAAS_API_KEY?.startsWith('$aact_prod_')||
 e.ASAAS_BILLING_ENABLED==='true')
 throw Error('Ajuste cancelado: esperados modo produção, chave produtiva e cobranças desativadas.');
async function call(path,method='GET',payload){
 const response=await fetch(base+path,{
  method,headers:{access_token:e.ASAAS_API_KEY,Accept:'application/json','Content-Type':'application/json',
   'User-Agent':'MeuRitmo-Webhook-Production-Repair/1.0'},
  ...(payload!==undefined?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(20000)
 });
 if(!response.ok)throw Error('Asaas produção retornou HTTP '+response.status+'; credenciais ocultas.');
 return response.json();
}
const listing=await call('/webhooks?limit=100');
if(!Array.isArray(listing.data))throw Error('Lista de webhooks de produção inválida.');
const matches=listing.data.filter(x=>typeof x.url==='string'&&x.url.replace(/\/$/,'')===dest);
if(matches.length!==1)throw Error('Configuração inesperada: não existe um único webhook no endereço esperado.');
const current=matches[0];
if(!/^[0-9a-f-]{32,36}$/i.test(current.id||'')||current.enabled!==true||
 current.interrupted===true||current.sendType!=='SEQUENTIALLY'||!Array.isArray(current.events))
 throw Error('Webhook não atende aos critérios; nenhuma alteração foi realizada.');
const missing=required.filter(x=>!current.events.includes(x));
console.log('Webhook existente localizado, ativo, com envio sequencial.');
console.log('Eventos ausentes: '+(missing.join(', ')||'nenhum'));
if(missing.length){
 // Preserva todos os eventos anteriores. O endpoint PUT altera somente o campo enviado.
 await call('/webhooks/'+encodeURIComponent(current.id),'PUT',{events:[...new Set([...current.events,...missing])]});
 console.log('Eventos ausentes acrescentados ao webhook existente, sem ativar cobranças.');
}
const verified=await call('/webhooks?limit=100');
const result=verified.data?.find(x=>x.id===current.id&&x.url===dest);
if(!result||result.enabled!==true||result.interrupted===true||
 !required.every(x=>result.events?.includes(x)))
 throw Error('A lista de eventos não foi confirmada após a atualização.');
console.log('CONFIRMADO: os nove eventos essenciais estão registrados em produção.');
console.log('Não houve alteração de tokens, endereço, habilitação de cobrança ou dados de clientes.');
