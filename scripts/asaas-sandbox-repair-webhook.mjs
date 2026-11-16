// Corrige SOMENTE a lista de eventos de um webhook já existente no Asaas Sandbox.
// Não toca no token de autenticação, URL, estado da fila ou ambiente de produção.
const env=process.env;
const host='https://api-sandbox.asaas.com/v3';
const target='https://meu-ritmo-asaas-sandbox.silva-joao-232334.workers.dev/api/billing/webhook/asaas';
const required=['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_REFUNDED','PAYMENT_UPDATED',
 'CHECKOUT_CREATED','CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','SUBSCRIPTION_CREATED'];
if(env.ASAAS_MODE!=='sandbox'||!env.ASAAS_API_KEY?.startsWith('$aact_hmlg_'))
 throw Error('Ambiente Sandbox ou chave de homologação inválidos; sem alterações.');
async function request(path,options={}){
 const r=await fetch(host+path,{method:options.method||'GET',headers:{
  access_token:env.ASAAS_API_KEY,accept:'application/json','Content-Type':'application/json',
  'User-Agent':'MeuRitmo-Webhook-Sandbox-Repair/1.0'
 },...(options.body?{body:JSON.stringify(options.body)}:{}),
 signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Asaas Sandbox respondeu HTTP '+r.status+'; nenhuma credencial foi exibida.');
 return r.json();
}
const before=await request('/webhooks?limit=100');
if(!Array.isArray(before.data))throw Error('Lista de webhooks do Asaas inválida.');
const found=before.data.filter(w=>typeof w.url==='string'&&w.url.replace(/\/$/,'')===target);
if(found.length!==1)throw Error('Era esperado um único webhook de homologação; nada foi alterado.');
const wh=found[0];
if(!/^[0-9a-f-]{32,36}$/i.test(wh.id||'')||wh.enabled!==true||wh.interrupted===true||
 wh.sendType!=='SEQUENTIALLY'||!Array.isArray(wh.events))
 throw Error('Webhook não corresponde à configuração segura esperada; nada foi alterado.');
const missing=required.filter(event=>!wh.events.includes(event));
console.log('Webhooks de homologação localizados: 1');
console.log('Eventos ausentes antes do reparo: '+(missing.length?missing.join(', '):'nenhum'));
if(missing.length){
 const merged=[...new Set([...wh.events,...missing])];
 await request('/webhooks/'+encodeURIComponent(wh.id),{method:'PUT',body:{events:merged}});
 console.log('A seleção de eventos do webhook existente foi atualizada.');
}
const after=await request('/webhooks?limit=100');
const updated=(after.data||[]).find(w=>w.id===wh.id&&w.url===wh.url);
if(!updated||updated.enabled!==true||updated.interrupted===true||
 !required.every(event=>updated.events?.includes(event)))
 throw Error('O Asaas não confirmou a lista completa de eventos após a atualização.');
console.log('Eventos obrigatórios cadastrados e confirmados: '+required.length);
console.log('Webhook ativo, destino preservado; nenhum token ou cobrança foi modificado.');
