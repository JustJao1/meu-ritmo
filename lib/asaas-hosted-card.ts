/** A hosted Asaas checkout keeps card numbers and CVV off Meu Ritmo servers.
 * This builds a request only; activation still requires D1 order mapping and
 * verified CHECKOUT / SUBSCRIPTION / PAYMENT webhooks. Never unlock benefits
 * from a redirect or from the checkout creation response.
 */
export type CardPlan='plus_month'|'plus_year'|'pro_month'|'pro_year';
type CardCheckoutOptions={
 orderId:string;
 customerId:string;
 plan:CardPlan;
 amountCents:number;
 nextDueDate:string;
 siteOrigin:string;
};
const orderPattern=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const customerPattern=/^cus_[A-Za-z0-9_-]{5,90}$/;
export function hostedCardCheckoutPayload(input:CardCheckoutOptions){
 if(!orderPattern.test(input.orderId))throw Error('Pedido inválido.');
 if(!customerPattern.test(input.customerId))throw Error('Cliente Asaas inválido.');
 if(!Number.isSafeInteger(input.amountCents)||input.amountCents<=0)throw Error('Preço inválido.');
 if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(input.nextDueDate))throw Error('Data de cobrança inválida.');
 const firstDate=new Date(input.nextDueDate.replace(' ','T')+'Z');
 if(!Number.isFinite(firstDate.getTime())||firstDate.toISOString().slice(0,19).replace('T',' ')!==input.nextDueDate)
  throw Error('Data de cobrança inválida.');
 const origin=new URL(input.siteOrigin);
 if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)
  throw Error('Origem inválida.');
 const cycle=input.plan.endsWith('_year')?'YEARLY':'MONTHLY';
 const label=input.plan.startsWith('plus_')?'Plus':'Pro';
 const callback={
  successUrl:new URL('/app?billing=awaiting_webhook',origin).toString(),
  cancelUrl:new URL('/app?billing=canceled',origin).toString(),
  expiredUrl:new URL('/app?billing=expired',origin).toString()
 };
 return {
  billingTypes:['CREDIT_CARD'] as const,
  chargeTypes:['RECURRENT'] as const,
  minutesToExpire:60,
  externalReference:input.orderId,
  customer:input.customerId,
  callback,
  items:[{name:'MR: Meu Ritmo '+label,description:'Assinatura '+(cycle==='YEARLY'?'anual':'mensal'),quantity:1,value:input.amountCents/100}],
  subscription:{cycle,nextDueDate:input.nextDueDate}
 };
}
