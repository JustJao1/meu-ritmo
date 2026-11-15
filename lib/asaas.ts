/**
 * Asaas server-side API client.
 * All endpoints are relative paths under /v3; the API key never reaches the browser.
 * This module does not enable billing or modify entitlements on its own.
 */
import {env} from 'cloudflare:workers';

export type AsaasBillingType = 'UNDEFINED' | 'PIX' | 'BOLETO' | 'CREDIT_CARD';
export type AsaasCycle = 'MONTHLY' | 'YEARLY';
export type AsaasPlanCode = 'plus_month' | 'plus_year' | 'pro_month' | 'pro_year';

export type AsaasCustomer = { id: string; name?: string; email?: string; cpfCnpj?: string };
export type AsaasPayment = {
  id: string;
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;
  status: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  externalReference?: string;
  subscription?: string;
};
export type AsaasSubscription = {
  id: string;
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  cycle: AsaasCycle;
  status?: string;
  externalReference?: string;
};

type BillingEnv = Record<string, string | undefined>;
const environment = () => env as unknown as BillingEnv;
export function asaasConfig() {
  const e = environment();
  const mode = e.ASAAS_MODE === 'production' ? 'production' : 'sandbox';
  const baseUrl = mode === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
  const key=e.ASAAS_API_KEY?.trim();
  // New Asaas keys identify their environment. Older, unprefixed keys remain valid.
  // Never send an obviously production key to Sandbox or a Sandbox key to production.
  const keyMatchesMode=!!key && (mode==='production'
    ?!key.startsWith('$aact_hmlg_'):!key.startsWith('$aact_prod_'));
  const apiReady=!!key && keyMatchesMode;
  const token=e.ASAAS_WEBHOOK_TOKEN;
  const tokenReady=!!token && token.length>=32 && token.length<=255 && !/\s/.test(token);
  const webhookReady=apiReady&&tokenReady&&e.ASAAS_WEBHOOK_READY==='true';
  // Closing new sales must never stop processing existing payments or refunds.
  const enabled=webhookReady&&e.ASAAS_BILLING_ENABLED==='true';
  return {mode,baseUrl,enabled,apiReady,webhookReady,keyMatchesMode,key,webhookToken:token};
}

function endpoint(path:string) {
  if (!/^\/[a-zA-Z0-9/_-]+(?:\?[a-zA-Z0-9_=&%-]+)?$/.test(path) || path.includes('..')) {
    throw new Error('Endpoint Asaas inválido.');
  }
  return path;
}
export async function asaasRequest<T>(path:string,options:{method?:'GET'|'POST'|'PUT'|'DELETE';body?:unknown}={}):Promise<T> {
  const c=asaasConfig();
  if (!c.apiReady) throw new Error('Credenciais Asaas indisponíveis ou incompatíveis com o ambiente.');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch(c.baseUrl+endpoint(path),{
      method:options.method||'GET',
      signal:controller.signal,
      headers:{'access_token':c.key!,'accept':'application/json','content-type':'application/json',
        'User-Agent':'MeuRitmo/1.0 (billing integration)'},
      ...(options.body!==undefined?{body:JSON.stringify(options.body)}:{})
    });
    if(!response.ok) {
      // Do not leak provider payloads, card data, credentials or personal data.
      throw new Error('Asaas não concluiu a solicitação ('+response.status+').');
    }
    return await response.json() as T;
  } catch(e) {
    if(e instanceof Error && e.name==='AbortError') throw new Error('Tempo limite na comunicação com Asaas.');
    throw e;
  } finally {clearTimeout(timeout);}
}

export function createAsaasCustomer(body:{name:string;cpfCnpj:string;email:string;externalReference:string}) {
  return asaasRequest<AsaasCustomer>('/customers',{method:'POST',body});
}
export function createAsaasPayment(body:{
  customer:string;billingType:AsaasBillingType;value:number;dueDate:string;
  externalReference:string;description:string;
}) {
  return asaasRequest<AsaasPayment>('/payments',{method:'POST',body});
}
export function getAsaasPayment(id:string) {
  if(!/^pay_[A-Za-z0-9]+$/.test(id)) throw new Error('Identificador de cobrança inválido.');
  return asaasRequest<AsaasPayment>('/payments/'+id);
}
export function createAsaasSubscription(body:{
  customer:string;billingType:AsaasBillingType;value:number;
  nextDueDate:string;cycle:AsaasCycle;externalReference:string;description:string;
}) {
  return asaasRequest<AsaasSubscription>('/subscriptions',{method:'POST',body});
}
export function cancelAsaasSubscription(id:string) {
  if(!/^sub_[A-Za-z0-9]+$/.test(id)) throw new Error('Identificador de assinatura inválido.');
  return asaasRequest<unknown>('/subscriptions/'+id,{method:'DELETE'});
}
export function hasValidAsaasWebhookToken(supplied:string|null) {
  const expected=asaasConfig().webhookToken;
  if(!expected||!supplied||expected.length!==supplied.length) return false;
  let diff=0;
  for(let i=0;i<expected.length;i++) diff|=expected.charCodeAt(i)^supplied.charCodeAt(i);
  return diff===0;
}
