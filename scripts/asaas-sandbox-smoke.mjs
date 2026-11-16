// Reusable, read-only verification of the real Asaas Sandbox connection.
// Do not use in production. All output deliberately excludes keys and customer data.
const base='https://api-sandbox.asaas.com/v3';
const worker='https://meu-ritmo-asaas-sandbox.silva-joao-232334.workers.dev';
const errors=[],warnings=[];
const mode=process.env.ASAAS_MODE;
const key=process.env.ASAAS_API_KEY||'';
const show=(name,value)=>console.log(name+': '+value);
function issue(message){errors.push(message);console.error('FALHA: '+message)}
function caution(message){warnings.push(message);console.log('PENDÊNCIA: '+message)}
async function call(path){
 const response=await fetch(base+path,{headers:{access_token:key,accept:'application/json','User-Agent':'MeuRitmo-Sandbox-Homologacao/1.0'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('API de testes respondeu HTTP '+response.status+' em '+path.split('?')[0]);
 return response.json();
}
show('Ambiente',mode==='sandbox'?'sandbox':'inválido');
if(mode!=='sandbox'||!key.startsWith('$aact_hmlg_')){
 issue('Chave e ambiente de homologação ausentes ou incompatíveis; nenhuma requisição será feita.');
 process.exitCode=1;
}else{
 try{
  const clients=await call('/customers?limit=1');
  show('Conexão autenticada ao Asaas Sandbox',Array.isArray(clients.data)?'OK':'resposta inesperada');
  if(!Array.isArray(clients.data))issue('Resposta de clientes fora do padrão');
 }catch(e){issue(e.message)}
 try{
  const list=await call('/webhooks?limit=100');
  const all=Array.isArray(list.data)?list.data:[];
  const relevant=all.filter(w=>typeof w.url==='string'&&w.url.replace(/\/$/,'')===worker+'/api/billing/webhook/asaas');
  show('Webhooks no endereço exclusivo do Sandbox',String(relevant.length));
  if(relevant.length!==1)caution('É necessário exatamente um webhook do Asaas apontando para o Worker Sandbox.');
  for(const w of relevant){
   show('Webhook ativo',String(w.enabled===true));
   show('Fila interrompida',String(w.interrupted===true));
   const events=Array.isArray(w.events)?w.events:[];
   show('Eventos essenciais presentes',String(['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_REFUNDED','PAYMENT_UPDATED','CHECKOUT_CREATED','CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','SUBSCRIPTION_CREATED'].every(e=>events.includes(e))));
   if(!w.enabled||w.interrupted||!['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_REFUNDED','PAYMENT_UPDATED'].every(e=>events.includes(e)))caution('Webhook precisa estar ativo e receber eventos de pagamento e reembolso.');
  }
 }catch(e){issue(e.message)}
 try{
  const r=await fetch(worker+'/api/billing/status',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  show('Worker Sandbox HTTP',String(r.status));
  if(!r.ok)issue('Sandbox não respondeu ao diagnóstico público.');
  else{
   const b=await r.json();
   for(const k of ['provider','mode','configured','earlyAccess','legalConfigured','manageAvailable'])
    show('Worker '+k,String(b[k]));
   if(b.mode!=='sandbox')issue('Worker não está configurado para sandbox.');
   if(!b.manageAvailable)caution('O Worker não dispõe de acesso à API de homologação.');
   if(!b.legalConfigured)caution('A identificação comercial ainda está incompleta no D1 de homologação.');
   if(!b.configured)caution('Checkout do Sandbox ainda não está ativado com webhook validado.');
  }
 }catch(e){issue(e.message)}
 show('Flag do GitHub para webhook',String(process.env.SANDBOX_ASAAS_WEBHOOK_READY||'false'));
 show('Flag do GitHub para checkout',String(process.env.SANDBOX_ASAAS_BILLING_ENABLED||'false'));
 show('Pendências',String(warnings.length));
 show('Falhas de integração',String(errors.length));
 if(errors.length)process.exitCode=1;
}
