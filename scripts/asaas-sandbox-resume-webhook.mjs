// Resume ONLY the previously interrupted Asaas Sandbox webhook, after the fixed
// Worker was deployed successfully and the quarantine migration exists in D1.
// Never uses a production API key, creates charges, or changes the webhook target/token.
const e=process.env;
const worker='https://meu-ritmo-asaas-sandbox.silva-joao-232334.workers.dev';
const target=worker+'/api/billing/webhook/asaas';
const base='https://api-sandbox.asaas.com/v3';
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
if(e.ASAAS_MODE!=='sandbox'||!e.ASAAS_API_KEY?.startsWith('$aact_hmlg_'))
 throw Error('Acesso negado: esta recuperação é exclusiva do Asaas Sandbox.');
if(!uuid.test(e.SANDBOX_D1_DATABASE_ID||'')||
 !uuid.test(e.PRODUCTION_D1_DATABASE_ID||'')||
 e.SANDBOX_D1_DATABASE_ID.toLowerCase()===e.PRODUCTION_D1_DATABASE_ID.toLowerCase())
 throw Error('A recuperação exige banco de testes isolado do banco principal.');
if(!e.CLOUDFLARE_ACCOUNT_ID||!e.CLOUDFLARE_API_TOKEN)
 throw Error('Permissão de leitura do D1 Sandbox indisponível.');
async function readStatus(){
 const r=await fetch(worker+'/api/billing/status',{headers:{accept:'application/json'},signal:AbortSignal.timeout(16000)});
 if(!r.ok)throw Error('Worker Sandbox indisponível: HTTP '+r.status);
 const d=await r.json();
 if(d.mode!=='sandbox'||d.provider!=='asaas'||d.manageAvailable!==true)
  throw Error('Worker remoto não corresponde ao Asaas Sandbox.');
 return d;
}
async function validateD1(){
 const u='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(e.CLOUDFLARE_ACCOUNT_ID)+
 '/d1/database/'+encodeURIComponent(e.SANDBOX_D1_DATABASE_ID)+'/query';
 const r=await fetch(u,{method:'POST',headers:{authorization:'Bearer '+e.CLOUDFLARE_API_TOKEN,
  'content-type':'application/json',accept:'application/json'},
  body:JSON.stringify({sql:"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('asaas_webhook_reviews','asaas_webhook_events')"}),
  signal:AbortSignal.timeout(18000)});
 if(!r.ok)throw Error('Não foi possível consultar o esquema do D1 Sandbox: HTTP '+r.status);
 const d=await r.json();
 if(!d.success||!d.result?.[0]?.success)throw Error('D1 Sandbox rejeitou conferência do esquema.');
 const names=(d.result[0].results||[]).map(x=>x.name);
 if(!names.includes('asaas_webhook_reviews')||!names.includes('asaas_webhook_events'))
  throw Error('D1 Sandbox ainda não tem todas as tabelas de recebimento seguro. Fila mantida interrompida.');
}
async function call(path,method='GET',body){
 const r=await fetch(base+path,{method,headers:{access_token:e.ASAAS_API_KEY,accept:'application/json',
  'content-type':'application/json','user-agent':'MeuRitmo-Sandbox-Webhook-Recovery/1.0'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Asaas Sandbox HTTP '+r.status+' durante '+method+' '+path.split('?')[0]);
 return r.json();
}
async function readWebhook(){
 const list=await call('/webhooks?limit=100');
 const matches=(Array.isArray(list.data)?list.data:[]).filter(w=>typeof w.url==='string'&&w.url.replace(/\/$/,'')===target);
 if(matches.length!==1)throw Error('Esperado exatamente um webhook no endereço de homologação.');
 const item=matches[0];
 if(!uuid.test(item.id||'')||item.enabled!==true||item.sendType!=='SEQUENTIALLY'||!Array.isArray(item.events)||
  !['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','CHECKOUT_PAID','SUBSCRIPTION_CREATED'].every(x=>item.events.includes(x)))
  throw Error('Configuração do webhook Sandbox não atende aos critérios de segurança.');
 return item;
}
await readStatus();
await validateD1();
const before=await readWebhook();
if(before.interrupted!==true){
 if(before.interrupted===false)console.log('Fila de homologação já está ativa; nenhuma alteração realizada.');
 else throw Error('Asaas não informou o estado da fila.');
}else{
 await call('/webhooks/'+encodeURIComponent(before.id),'PUT',{interrupted:false});
 const after=await readWebhook();
 if(after.interrupted!==false)throw Error('O Asaas não confirmou a reativação da fila Sandbox.');
 console.log('Fila de webhook Sandbox reativada; URL, token, eventos e conta de produção preservados.');
}
console.log('Recuperação finalizada. Os eventos pendentes serão reenviados pelo Asaas.');
