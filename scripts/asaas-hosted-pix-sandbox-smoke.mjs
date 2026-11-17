// Safe sandbox check: create then cancel an unpaid hosted Pix checkout.
const e=process.env;
if(e.ASAAS_MODE!=='sandbox'||!e.ASAAS_API_KEY?.startsWith('$aact_hmlg_'))
 throw Error('Somente o ambiente de homologação pode executar este teste.');
const base='https://api-sandbox.asaas.com/v3';
const request=async(path,method='GET',body)=>{
 const res=await fetch(base+path,{method,headers:{access_token:e.ASAAS_API_KEY,accept:'application/json','content-type':'application/json',
 'User-Agent':'MeuRitmo-HostedPix-Validation/1.0'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 const data=await res.json().catch(()=>({}));
 return {ok:res.ok,status:res.status,data};
};
const callbackOrigin='https://meu-ritmo-asaas-sandbox.silva-joao-232334.workers.dev';
const session=await request('/checkouts','POST',{
 billingTypes:['PIX'],chargeTypes:['DETACHED'],minutesToExpire:30,
 externalReference:'mr-hostedpix-validation-'+crypto.randomUUID(),
 items:[{name:'Validação técnica de checkout Pix',description:'Teste de integração; não efetuar pagamento',quantity:1,value:1.90}],
 callback:{successUrl:callbackOrigin+'/app?billing=awaiting_webhook',
 cancelUrl:callbackOrigin+'/app?billing=canceled',
 expiredUrl:callbackOrigin+'/app?billing=expired'}
});
console.log('Criação de Checkout Pix avulso: HTTP '+session.status);
if(!session.ok){
 console.log('Códigos Asaas: '+JSON.stringify((session.data.errors||[]).slice(0,3).map(x=>String(x.code||'unknown').slice(0,40))));
 throw Error('O Asaas Sandbox recusou a criação do Checkout hospedado Pix.');
}
const id=session.data.id;
if(typeof id!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
 throw Error('O checkout não retornou ID válido para cancelamento.');
const canceled=await request('/checkouts/'+encodeURIComponent(id)+'/cancel','POST');
console.log('Cancelamento do checkout de teste: HTTP '+canceled.status);
if(!canceled.ok)throw Error('Checkout sintético não foi cancelado; revisar sandbox manualmente.');
console.log('Checkout Pix hospedado: criação e cancelamento aprovados, nenhum pagamento efetuado.');
