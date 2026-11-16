// Real Pix-only Sandbox diagnostic: never uses production keys, real payers or money.
import {randomUUID} from 'node:crypto';
const e=process.env,base='https://api-sandbox.asaas.com/v3',today=new Date().toISOString().slice(0,10);
if(e.ASAAS_MODE!=='sandbox'||!e.ASAAS_API_KEY?.startsWith('$aact_hmlg_'))throw Error('Sandbox key/mode required');
async function ask(path,method='GET',body){
 const r=await fetch(base+path,{method,headers:{access_token:e.ASAAS_API_KEY,accept:'application/json',
  'content-type':'application/json','user-agent':'MeuRitmo-Pix-Sandbox-Audit/1.0'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000)});
 const v=await r.json().catch(()=>({}));
 return {http:r.status,ok:r.ok,data:v};
}
const keys=await ask('/pix/addressKeys?limit=100');
console.log('Chaves Pix cadastradas no Sandbox: '+(keys.ok?(keys.data.data?.length??'resposta inesperada'):'HTTP '+keys.http));
if(keys.ok&&Array.isArray(keys.data.data))
 console.log('Estados das chaves Pix: '+JSON.stringify(keys.data.data.reduce((acc,k)=>{const v=String(k.status||'UNKNOWN').replace(/[^A-Z_]/g,'');acc[v]=(acc[v]||0)+1;return acc;},{})));
const diagnostic=(r)=>Array.isArray(r.data?.errors)?r.data.errors.slice(0,3).map(x=>({
 code:String(x.code||'').replace(/[^a-zA-Z0-9_]/g,'').slice(0,60),
 message:String(x.description||'').replace(/\b\d{11,14}\b/g,'[redacted]').replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,'[email]').slice(0,180)
})):[];
const ref='mr_pixdiag_'+randomUUID(),errors=[];
let subId,paymentId;
try{
 const customer=await ask('/customers','POST',{name:'Meu Ritmo Teste Pix Sandbox',
  cpfCnpj:'24971563792',email:'teste.pix.'+randomUUID().slice(0,10)+'@example.com',
  mobilePhone:'11987654321',externalReference:ref,notificationDisabled:true});
 if(!customer.ok||!/^cus_/.test(customer.data.id||''))throw Error('Cliente fictício rejeitado: HTTP '+customer.http);
 const direct=await ask('/payments','POST',{customer:customer.data.id,billingType:'PIX',value:19.90,dueDate:today,externalReference:ref+'_direct',description:'Teste isolado QR Pix avulso'});
 console.log('Cobrança avulsa Pix: HTTP '+direct.http+' / '+String(direct.data.billingType)+' / '+JSON.stringify(diagnostic(direct)));
 if(direct.ok&&direct.data.id){
  try{
   const q=await ask('/payments/'+encodeURIComponent(direct.data.id)+'/pixQrCode');
   console.log('QR avulso: HTTP '+q.http+' / payload '+Boolean(q.data.payload)+' / imagem '+Boolean(q.data.encodedImage)+' / '+JSON.stringify(diagnostic(q)));
  }finally{const c=await ask('/payments/'+encodeURIComponent(direct.data.id),'DELETE'); console.log('Avulsa teste cancelada: HTTP '+c.http);}
 }
 for(const key of keys.data.data||[]){
  const q=await ask('/pix/qrCodes/static','POST',{addressKey:key.key,value:19.90,format:'ALL',expirationSeconds:60,allowsMultiplePayments:false,description:'Teste QR Sandbox',externalReference:ref+'_static'});
  console.log('QR estático por chave ACTIVE: HTTP '+q.http+' / payload '+Boolean(q.data.payload)+' / imagem '+Boolean(q.data.encodedImage)+' / '+JSON.stringify(diagnostic(q)));
  if(q.ok&&q.data.id){const c=await ask('/pix/qrCodes/static/'+encodeURIComponent(q.data.id),'DELETE');console.log('QR estático teste removido: HTTP '+c.http);}
 }
 const subscription=await ask('/subscriptions','POST',{customer:customer.data.id,billingType:'PIX',
   cycle:'MONTHLY',value:19.90,nextDueDate:today,externalReference:ref,
   description:'Auditoria Pix exclusivo Meu Ritmo - Sandbox'});
 if(!subscription.ok||!/^sub_/.test(subscription.data.id||''))throw Error('Assinatura Pix rejeitada: HTTP '+subscription.http);
 subId=subscription.data.id;
 console.log('Assinatura solicitada como Pix; resposta billingType: '+String(subscription.data.billingType));
 let invoice;
 for(let i=0;i<12;i++){
  const l=await ask('/subscriptions/'+encodeURIComponent(subId)+'/payments?limit=10');
  if(!l.ok)throw Error('Falha na lista de cobranças: HTTP '+l.http);
  invoice=l.data.data?.[0];if(invoice?.id)break;
  await new Promise(resolve=>setTimeout(resolve,1200));
 }
 if(!invoice?.id)throw Error('Asaas não criou a primeira fatura Pix.');
 paymentId=invoice.id;
 const saved=await ask('/payments/'+encodeURIComponent(paymentId));
 if(!saved.ok)throw Error('GET da fatura falhou: HTTP '+saved.http);
 console.log('Primeira fatura persistida: '+saved.data.billingType+' / '+saved.data.status);
 const before=await ask('/payments/'+encodeURIComponent(paymentId)+'/pixQrCode');
 const beforePayload=typeof before.data.payload==='string'&&before.data.payload.length>35;
 console.log('QR Code Pix disponível antes de conversão: '+before.http+' / '+beforePayload+' / '+JSON.stringify(diagnostic(before)));
 if(saved.data.billingType!=='PIX'){
  const converted=await ask('/payments/'+encodeURIComponent(paymentId),'PUT',{
   billingType:'PIX',value:saved.data.value,dueDate:saved.data.dueDate});
  console.log('Conversão explícita da fatura para PIX: HTTP '+converted.http+
    ' / billingType '+String(converted.data.billingType||'não retornado'));
  if(!converted.ok)errors.push('conversion_http_'+converted.http);
 }
 const final=await ask('/payments/'+encodeURIComponent(paymentId));
 const qr=await ask('/payments/'+encodeURIComponent(paymentId)+'/pixQrCode');
 const isQr=qr.ok&&typeof qr.data.payload==='string'&&qr.data.payload.length>35&&
    typeof qr.data.encodedImage==='string'&&qr.data.encodedImage.length>100;
 console.log('Fatura final: '+String(final.data.billingType)+' / '+String(final.data.status));
 console.log('Pix Copia e Cola e QR válidos: '+isQr+' / HTTP '+qr.http+' / '+JSON.stringify(diagnostic(qr)));
 if(!isQr)errors.push('pix_qr_not_available');
 if(final.data.billingType!=='PIX')errors.push('billing_type_not_pix');
}finally{
 if(subId){const r=await ask('/subscriptions/'+encodeURIComponent(subId),'DELETE');
  console.log('Assinatura sintética cancelada: HTTP '+r.http);}
 if(paymentId){
  const r=await ask('/payments/'+encodeURIComponent(paymentId),'DELETE');
  console.log('Fatura sintética cancelada: HTTP '+r.http);
 }
}
if(errors.length){console.error('Resultado: INCOMPATIBILIDADE PIX SANDBOX ('+errors.join(',')+')');process.exitCode=1;}
else console.log('Resultado: PIX CONFIRMADO: fatura PIX, QR dinâmico e Pix Copia e Cola disponíveis.');
