import {billingConfig} from '../../../../lib/billing';
import {getUser} from '../../../session';
import {appRole} from '../../../../lib/admin-access';
import {env} from 'cloudflare:workers';

export async function GET(req:Request){
  const c=billingConfig();
  const legal=await env.DB!.prepare("SELECT value FROM service_settings WHERE key='legal'").first<any>();
  const result:Record<string,unknown>={configured:c.enabled&&Object.values(c.prices).every(Boolean)&&!!legal,mode:c.mode,legalConfigured:!!legal};
  if(new URL(req.url).searchParams.get('diagnostic')==='1'){
    const user=await getUser();
    if(!user||await appRole(user)!=='owner')return Response.json({error:'Diagnóstico disponível somente ao proprietário autenticado.'},{status:403,headers:{'Cache-Control':'no-store'}});
    const e=env as unknown as Record<string,string>;
    result.diagnostic={
      liveEnabled:e.BILLING_LIVE_ENABLED==='true',
      webhookReady:e.BILLING_WEBHOOK_READY==='true',
      liveSecretKeyFormat:!!e.STRIPE_SECRET_KEY?.startsWith('sk_live_'),
      webhookSecretPresent:!!e.STRIPE_WEBHOOK_SECRET,
      plusMonthPricePresent:!!e.STRIPE_PLUS_MONTH_PRICE,
      plusYearPricePresent:!!e.STRIPE_PLUS_YEAR_PRICE,
      proMonthPricePresent:!!e.STRIPE_PRO_MONTH_PRICE,
      proYearPricePresent:!!e.STRIPE_PRO_YEAR_PRICE
    };
  }
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}
