// Read-only audit of Pix keys in production. Never exposes key values or account IDs.
const e=process.env;
if(e.ASAAS_MODE!=='production'||!e.ASAAS_API_KEY?.startsWith('$aact_prod_'))
 throw Error('Audit blocked: production key and production mode required.');
const r=await fetch('https://api.asaas.com/v3/pix/addressKeys?limit=100',{
 headers:{access_token:e.ASAAS_API_KEY,accept:'application/json','user-agent':'MeuRitmo-Pix-Production-ReadOnly/1.0'},
 signal:AbortSignal.timeout(25000)
});
const result=await r.json().catch(()=>({}));
if(!r.ok||!Array.isArray(result.data))throw Error('Unable to list production Pix key status: HTTP '+r.status);
const counts=result.data.reduce((acc,k)=>{const status=String(k.status||'UNKNOWN').replace(/[^A-Z_]/g,'').slice(0,40);
 acc[status]=(acc[status]||0)+1;return acc;},{});
console.log('Asaas produção: número de chaves Pix: '+result.data.length);
console.log('Asaas produção: estados das chaves Pix: '+JSON.stringify(counts));
console.log('Nota: chave ACTIVE não prova que recebimentos Pix por cobranças estejam habilitados; o QR Code deve ser homologado separadamente.');
