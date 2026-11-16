// Helen support retest: synthetic payments, sandbox only.
import {randomUUID} from 'node:crypto';
const e=process.env,base='https://api-sandbox.asaas.com/v3';
if(e.ASAAS_MODE!=='sandbox'||!e.ASAAS_API_KEY?.startsWith('$aact_hmlg_'))throw Error('Sandbox required');
async function ask(path,method='GET',body){
 const r=await fetch(base+path,{method,headers:{access_token:e.ASAAS_API_KEY,'content-type':'application/json','User-Agent':'MeuRitmo-Helen-Retest/1.0'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
 const data=await r.json().catch(()=>({}));
 return {http:r.status,data};
}
const customer=await ask('/customers','POST',{name:'Meu Ritmo Helen Sandbox Retest',cpfCnpj:'24971563792',email:'helen-retest-'+randomUUID()+'@example.com',notificationDisabled:true});
if(!customer.data.id)throw Error('Synthetic customer HTTP '+customer.http);
const holder={name:'Pagador Teste Sandbox',email:'pagador@exemplo.test',cpfCnpj:'24971563792',postalCode:'01001000',addressNumber:'100',phone:'11999999999',mobilePhone:'11999999999'};
for(const [label,number,expected] of [['approval_control','4444444444444444','approved'],['mastercard_decline','5184019740373151','declined'],['visa_decline','4916561358240741','declined']]){
 const r=await ask('/payments','POST',{customer:customer.data.id,billingType:'CREDIT_CARD',value:7.91,dueDate:new Date().toISOString().slice(0,10),description:'Helen support Sandbox retest',externalReference:'mr_helen_'+randomUUID(),creditCard:{holderName:holder.name,number,expiryMonth:'12',expiryYear:String(new Date().getUTCFullYear()+3),ccv:'123'},creditCardHolderInfo:holder,remoteIp:'203.0.113.10'});
 const id=r.data.id;
 let persisted=null;
 if(id){const check=await ask('/payments/'+encodeURIComponent(id));persisted=check.data.status;}
 const errors=(r.data.errors||[]).map(x=>({code:String(x.code||'').slice(0,80),description:String(x.description||'').replace(/\b\d{11,19}\b/g,'[identifier]').replace(/[\w.+-]+@[\w.-]+/g,'[email]').slice(0,250)}));
 console.log(JSON.stringify({test:label,expected,http:r.http,status:r.data.status||null,id:id||null,persisted,errors}));
 if(id){const cleanup=await ask('/payments/'+encodeURIComponent(id)+'/refund','POST',{description:'Synthetic sandbox support retest cleanup'});console.log(JSON.stringify({test:label,cleanupHttp:cleanup.http,cleanupStatus:cleanup.data.status||null}));}
}
console.log('Completed synthetic card retest. Production not used.');
