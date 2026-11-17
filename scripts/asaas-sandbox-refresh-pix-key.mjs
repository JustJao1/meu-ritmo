// Repair the Asaas Sandbox Pix key affected by the Nov 14-15 incident.
// Never uses production credentials, deletes existing keys, or prints key values.
const e=process.env;
if(e.ASAAS_MODE!=='sandbox'||!e.ASAAS_API_KEY?.startsWith('$aact_hmlg_'))
 throw Error('Operação bloqueada: apenas ambiente Asaas Sandbox.');
const base='https://api-sandbox.asaas.com/v3';
async function call(path,method='GET',body){
 const r=await fetch(base+path,{method,headers:{
  access_token:e.ASAAS_API_KEY,accept:'application/json',
  'content-type':'application/json','user-agent':'MeuRitmo-Sandbox-PixKeyRepair/1.0'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(25000)});
 return {ok:r.ok,status:r.status,data:await r.json().catch(()=>({}))};
}
const list=()=>call('/pix/addressKeys?limit=100');
const before=await list();
if(!before.ok||!Array.isArray(before.data.data))
 throw Error('Não foi possível listar as chaves do Sandbox; nenhuma alteração realizada.');
const keys=before.data.data;
const counts=keys.reduce((a,k)=>{const st=String(k.status||'UNKNOWN').replace(/[^A-Z_]/g,'').slice(0,40);a[st]=(a[st]||0)+1;return a;},{});
console.log('Antes da correção: '+keys.length+' chaves no Sandbox; estados '+JSON.stringify(counts));
// A second run of this workflow should not register another key if the account
// already has a newly registered key made during this maintenance window.
const maintenance=Date.parse('2026-11-17T12:30:00-03:00');
const newer=keys.some(k=>{
 const created=Date.parse(k.dateCreated||k.createdAt||k.created||'');
 return Number.isFinite(created)&&created>=maintenance&&
  ['ACTIVE','AWAITING_ACTIVATION'].includes(k.status);
});
if(newer){
 console.log('Existe uma chave nova criada depois do início da manutenção. Nenhuma chave extra será criada.');
}else{
 // A conservative ceiling avoids filling a PF sandbox with old broken keys.
 if(keys.filter(k=>k.status!=='DELETED').length>=5)
  throw Error('A conta já possui 5 chaves não excluídas; revisão manual para evitar excesso.');
 const result=await call('/pix/addressKeys','POST',{type:'EVP'});
 console.log('Registro de nova chave Pix aleatória Sandbox: HTTP '+result.status);
 if(!result.ok){
  console.log('Códigos de erro: '+JSON.stringify((result.data.errors||[]).slice(0,5).map(x=>String(x.code||'').replace(/[^A-Za-z0-9_]/g,'').slice(0,45))));
  throw Error('O Asaas recusou criar a nova chave Pix Sandbox.');
 }
 // Do not log response body; it can contain the raw key and QR payload.
 console.log('Solicitação de nova chave aceita pelo Asaas Sandbox.');
}
const after=await list();
if(!after.ok||!Array.isArray(after.data.data))
 throw Error('Chave solicitada, mas a consulta posterior não foi possível.');
const statuses=after.data.data.reduce((a,k)=>{const st=String(k.status||'UNKNOWN').replace(/[^A-Z_]/g,'').slice(0,40);a[st]=(a[st]||0)+1;return a;},{});
console.log('Após manutenção: '+after.data.data.length+' chaves, estados '+JSON.stringify(statuses));
if(!(statuses.ACTIVE>0))throw Error('Nenhuma chave Pix ACTIVE no Sandbox. Não homologar Checkout Pix.');
