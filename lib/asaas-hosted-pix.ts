/** Isolated one-off Pix purchase on Asaas's own hosted payment page.
 * Neither a callback nor the Checkout creation response activates a plan.
 * Each purchase gives one paid period, renewed manually when it expires.
 */
export type PixPlan='plus_month'|'plus_year'|'pro_month'|'pro_year';
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const customer=/^cus_[A-Za-z0-9_-]{5,90}$/;
export const hostedCheckoutUrl=(id:string)=>{
 if(!uuid.test(id))throw Error('Identificador do Checkout inválido.');
 return 'https://asaas.com/checkoutSession/show?id='+encodeURIComponent(id);
};
export function hostedPixCheckoutPayload(input:{
 orderId:string;customerId:string;plan:PixPlan;amountCents:number;siteOrigin:string;
}){
 if(!uuid.test(input.orderId)||!customer.test(input.customerId))throw Error('Identificação comercial inválida.');
 if(!Number.isSafeInteger(input.amountCents)||input.amountCents<100)throw Error('Valor inválido.');
 const url=new URL(input.siteOrigin);
 const approved=new Set(['meuritmo.net','www.meuritmo.net','meu-ritmo-asaas-sandbox.silva-joao-232334.workers.dev']);
 if(url.protocol!=='https:'||!approved.has(url.hostname)||url.pathname!=='/'||url.search||url.hash||url.username||url.password)
  throw Error('Origem do pagamento inválida.');
 const label=input.plan.startsWith('plus_')?'Plus':'Pro';
 const annual=input.plan.endsWith('_year');
 return {
  billingTypes:['PIX'] as const,chargeTypes:['DETACHED'] as const,
  minutesToExpire:60,customer:input.customerId,externalReference:input.orderId,
  items:[{name:'MR: Meu Ritmo '+label,description:(annual?'Acesso anual':'Acesso mensal')+' com renovação manual',quantity:1,value:input.amountCents/100}],
  callback:{
   successUrl:new URL('/app?billing=awaiting_webhook',url).toString(),
   cancelUrl:new URL('/app?billing=canceled',url).toString(),
   expiredUrl:new URL('/app?billing=expired',url).toString()
  }
 };
}
/** The given period is counted from verified settlement, not invoice creation. */
export function paidThrough(timeSeconds:number,plan:PixPlan){
 const date=new Date(timeSeconds*1000);
 if(!Number.isFinite(date.getTime()))throw Error('Data do pagamento inválida.');
 const yearly=plan.endsWith('_year');
 const nextYear=date.getUTCFullYear()+(yearly?1:0),nextMonth=date.getUTCMonth()+(yearly?0:1);
 const day=Math.min(date.getUTCDate(),new Date(Date.UTC(nextYear,nextMonth+1,0)).getUTCDate());
 return Math.floor(Date.UTC(nextYear,nextMonth,day,date.getUTCHours(),date.getUTCMinutes(),date.getUTCSeconds())/1000);
}
