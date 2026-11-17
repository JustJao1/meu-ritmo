// Idempotent, production-only registration of one random EVP Pix key.
const e=process.env;
if(e.ASAAS_MODE!=='production'||!e.ASAAS_API_KEY?.startsWith('$aact_prod_'))
 throw Error('Requer ambiente de produção Asaas e chave de API de produção.');
const url='https://api.asaas.com/v3/pix/addressKeys';
async function call(method,body){
 const res=await fetch(url,{method,headers:{access_token:e.ASAAS_API_KEY,accept:'application/json',
   'content-type':'application/json','User-Agent':'MeuRitmo-ProductionPixSetup/1.0'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const result=await res.json().catch(()=>({}));
 return {ok:res.ok,status:res.status,result};
}
const existing=await call('GET');
if(!existing.ok||!Array.isArray(existing.result.data))throw Error('Não foi possível verificar as chaves Pix da produção.');
const keys=existing.result.data;
const active=keys.filter(k=>k.status==='ACTIVE').length;
const pending=keys.filter(k=>!['ACTIVE','DELETED','ERROR'].includes(k.status)).length;
console.log('Pix produção: '+active+' chaves ativas, '+pending+' aguardando processamento; status '+JSON.stringify(keys.reduce((a,k)=>{const status=String(k.status||'UNKNOWN').replace(/[^A-Z_]/g,'');a[status]=(a[status]||0)+1;return a;},{})));
if(active>0){console.log('Chave ativa já cadastrada. Nenhuma alteração executada.');}
else if(pending>0){console.log('Existe chave pendente. Não será criada outra chave.');}
else{
 const created=await call('POST',{type:'EVP'});
 console.log('Solicitação de chave aleatória EVP em produção: HTTP '+created.status);
 if(!created.ok){
  const codes=(created.result.errors||[]).slice(0,4).map(x=>String(x.code||'unknown').replace(/[^A-Za-z0-9_]/g,'').slice(0,50));
  console.log('Códigos de erro do Asaas: '+JSON.stringify(codes));
  throw Error('O Asaas não autorizou o cadastro da chave Pix. Verificar aprovação e prova de vida.');
 }
 console.log('Chave aleatória solicitada sem imprimir dados privados. Conferir a ativação no Asaas.');
}
