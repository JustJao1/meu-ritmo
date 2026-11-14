import {EARLY_ACCESS_ACTIVE} from '../../../../lib/entitlements';
import {asaasConfig} from '../../../../lib/asaas';
import {getUser} from '../../../session';
import {appRole} from '../../../../lib/admin-access';
import {env} from 'cloudflare:workers';
export async function GET(req:Request){
  const c=asaasConfig();
  const legal=await env.DB!.prepare("SELECT value FROM service_settings WHERE key='legal'").first();
  const result:Record<string,unknown>={configured:!EARLY_ACCESS_ACTIVE&&c.enabled&&!!legal,earlyAccess:EARLY_ACCESS_ACTIVE,mode:c.mode,legalConfigured:!!legal,provider:'asaas'};
  if(new URL(req.url).searchParams.get('diagnostic')==='1'){
    const user=await getUser();
    if(!user||await appRole(user)!=='owner')return Response.json({error:'Somente o proprietário.'},{status:403});
    const e=env as unknown as Record<string,string>;
    result.diagnostic={apiKeyPresent:!!e.ASAAS_API_KEY,webhookTokenPresent:!!e.ASAAS_WEBHOOK_TOKEN,webhookReady:e.ASAAS_WEBHOOK_READY==='true',enabled:e.ASAAS_BILLING_ENABLED==='true',mode:c.mode};
  }
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}
