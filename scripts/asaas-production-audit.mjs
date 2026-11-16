// Auditoria somente leitura da configuração de PRODUÇÃO; não cria cobranças,
// clientes, assinaturas, webhooks ou tokens. Nunca imprime valores de segredo.
const e=process.env;
const needed=['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_REFUNDED','PAYMENT_UPDATED',
 'CHECKOUT_CREATED','CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','SUBSCRIPTION_CREATED'];
const show=(name,value)=>console.log(name+': '+value);
const flag=k=>e[k]==='true';
const key=e.ASAAS_API_KEY||'';
const token=e.ASAAS_WEBHOOK_TOKEN||'';
const activeMode=e.ASAAS_MODE==='production';
show('Produção: modo configurado',e.ASAAS_MODE==='production'?'production':e.ASAAS_MODE==='sandbox'?'sandbox':'ausente/inválido');
show('Produção: API Key registrada no GitHub',Boolean(key));
show('Produção: formato de chave',!key?'ausente':key.startsWith('$aact_prod_')?'produção':key.startsWith('$aact_hmlg_')?'sandbox (incompatível)':'legado ou não identificado');
show('Produção: token de webhook registrado',token.length>=32&&token.length<=255&&!/\s/.test(token));
for(const k of ['ASAAS_WEBHOOK_READY','ASAAS_BILLING_ENABLED','ASAAS_CARD_CHECKOUT_ENABLED','ASAAS_PRODUCTION_CARD_APPROVED','EARLY_ACCESS_ENABLED'])
 show('Produção: '+k,flag(k));
try{
 const response=await fetch('https://meuritmo.net/api/billing/status',{signal:AbortSignal.timeout(18000)});
 show('Site principal: conexão HTTP',response.status);
 if(response.ok){
  const body=await response.json();
  for(const k of ['mode','legalConfigured','configured','earlyAccess','manageAvailable','cardAvailable'])
   show('Site principal: '+k,String(body[k]));
  if(typeof body.earlyAccess==='boolean'&&body.earlyAccess!==flag('EARLY_ACCESS_ENABLED'))
   show('ATENÇÃO: acesso antecipado', 'GitHub e site publicado divergem; reavaliar após deploy');
  if(body.mode!==e.ASAAS_MODE)
   show('ATENÇÃO: modo do Asaas', 'GitHub e site publicado divergem');
 }
}catch{show('Site principal: consulta','indisponível')}
if(activeMode&&key&& !key.startsWith('$aact_hmlg_')){
 const base='https://api.asaas.com/v3';
 const call=async path=>{
  const res=await fetch(base+path,{headers:{access_token:key,accept:'application/json',
   'User-Agent':'MeuRitmo-Production-Config-Audit/1.0'},signal:AbortSignal.timeout(18000)});
  if(!res.ok)throw Error('API Asaas produção HTTP '+res.status);
  return res.json();
 };
 try{
  const customers=await call('/customers?limit=1');
  show('Asaas produção: API autenticada',Array.isArray(customers.data));
 }catch(err){show('Asaas produção: API autenticada','não ('+String(err.message||'erro')+')')}
 try{
  const list=await call('/webhooks?limit=100');
  if(!Array.isArray(list.data))throw Error('resposta inesperada');
  const target='https://meuritmo.net/api/billing/webhook/asaas';
  const matches=list.data.filter(w=>typeof w.url==='string'&&w.url.replace(/\/$/,'')===target);
  show('Asaas produção: webhooks no endereço correto',matches.length);
  if(matches.length===1){
   const wh=matches[0];
   show('Asaas produção: webhook ativo',wh.enabled===true);
   show('Asaas produção: fila interrompida',wh.interrupted===true);
   show('Asaas produção: envio sequencial',wh.sendType==='SEQUENTIALLY');
   show('Asaas produção: eventos ausentes',needed.filter(x=>!wh.events?.includes(x)).join(', ')||'nenhum');
  }else show('Asaas produção: situação do webhook','ausente ou duplicado');
 }catch(err){show('Asaas produção: conferência dos webhooks','indisponível ('+String(err.message||'erro')+')')}
}else{
 show('Asaas produção: API/webhook remoto','não consultado: sem chave produtiva e modo apropriado');
}
console.log('Auditoria somente leitura concluída. Nenhuma cobrança, configuração ou segredo foi alterado.');
