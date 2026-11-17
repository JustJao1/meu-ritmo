// Auditoria estritamente somente leitura de cobranças de homologação
// já criadas pelo próprio projeto no Sandbox. Nenhuma cobrança é criada.
// Nunca imprime IDs, dados pessoais, credenciais ou dados de cartão.
const env=process.env;
if(env.ASAAS_MODE!=='sandbox'||!env.ASAAS_API_KEY?.startsWith('$aact_hmlg_'))
 throw Error('Auditoria bloqueada fora do ambiente Sandbox.');
const base='https://api-sandbox.asaas.com/v3';
async function get(path){
 const r=await fetch(base+path,{headers:{access_token:env.ASAAS_API_KEY,Accept:'application/json','User-Agent':'MeuRitmo-Sandbox-ReadOnly/1.0'},
  signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Falha na consulta somente leitura à API: HTTP '+r.status);
 return await r.json();
}
const today=new Date(),from=new Date(today.getTime()-30*86400000).toISOString().slice(0,10);
const entries=[];
for(let offset=0;offset<=900;offset+=100){
 const path='/payments?limit=100&offset='+offset+'&billingType=CREDIT_CARD&dateCreated%5Bge%5D='+from;
 const batch=await get(path);
 if(!Array.isArray(batch.data))throw Error('Formato inesperado da listagem de pagamentos.');
 entries.push(...batch.data);
 if(!batch.hasMore)break;
 if(offset===900)throw Error('A consulta excedeu 1000 cobranças; auditoria interrompida.');
}
const own=entries.filter(p=>p.description==='Homologacao de cartao avulso, apenas Sandbox');
const counts={};
let persist=0,missing=0,differentStatus=0,uncertain=0,withPaymentDate=0;
const cards={mastercardRecusa:{count:0,confirmed:0,brands:{}},visaRecusa:{count:0,confirmed:0,brands:{}},
  controleAprovacao:{count:0,confirmed:0,brands:{}},outrosOuNaoIdentificados:{count:0,confirmed:0,brands:{}}};
for(const p of own){
 if(typeof p.id!=='string'||!/^pay_[a-zA-Z0-9_-]+$/.test(p.id))continue;
 const current=await get('/payments/'+encodeURIComponent(p.id));
 persist++;
 const status=typeof current.status==='string'?current.status:'UNKNOWN';
 counts[status]=(counts[status]||0)+1;
 if(status!==p.status)differentStatus++;
 if(current.billingType!=='CREDIT_CARD')uncertain++;
 if(current.paymentDate||current.confirmedDate)withPaymentDate++;
 const suffix=String(current.creditCard?.creditCardNumber||'').replace(/\D/g,'').slice(-4);
 const category=suffix==='3151'?'mastercardRecusa':suffix==='0741'?'visaRecusa':
  suffix==='4444'?'controleAprovacao':'outrosOuNaoIdentificados';
 cards[category].count++;
 if(status==='CONFIRMED')cards[category].confirmed++;
 const brand=String(current.creditCard?.creditCardBrand||'UNKNOWN');
 const safeBrand=['VISA','MASTERCARD','UNKNOWN'].includes(brand)?brand:'OTHER';
 cards[category].brands[safeBrand]=(cards[category].brands[safeBrand]||0)+1;
}
console.log('Janela de consulta: últimos 30 dias');
console.log('Cobranças sintéticas do teste localizadas: '+own.length);
console.log('Cobranças consultadas individualmente: '+persist);
console.log('Distribuição dos status persistidos: '+JSON.stringify(counts));
console.log('Situação por cartão de homologação (identificado somente pelos quatro dígitos finais): '+JSON.stringify(cards));
console.log('Mudança entre lista e consulta individual: '+differentStatus);
console.log('Forma de pagamento divergente do cartão: '+uncertain);
console.log('Cobranças com data de pagamento/confirmação: '+withPaymentDate);
console.log('Auditoria de leitura concluída, sem pagamentos, novos clientes ou alterações.');

if(cards.mastercardRecusa.count||cards.visaRecusa.count){
 const failures=cards.mastercardRecusa.confirmed+cards.visaRecusa.confirmed;
 console.log('INCONSISTÊNCIA com cartões de recusa: '+failures+' confirmados; causa no simulador não comprovada.');
}else console.log('Nenhum cartão de recusa do teste foi localizado na janela consultada.');
