import {EARLY_ACCESS_ACTIVE} from '../../../../lib/entitlements';
import {asaasConfig,asaasRequest} from '../../../../lib/asaas';
import {getUser} from '../../../session';
import {appRole} from '../../../../lib/admin-access';
import {env} from 'cloudflare:workers';
export async function GET(req:Request){
  const c=asaasConfig();
  const legal=await env.DB!.prepare("SELECT value FROM service_settings WHERE key='legal'").first();
  const result:Record<string,unknown>={configured:!EARLY_ACCESS_ACTIVE&&c.enabled&&!!legal,earlyAccess:EARLY_ACCESS_ACTIVE,mode:c.mode,legalConfigured:!!legal,provider:'asaas',manageAvailable:c.apiReady};
  if(new URL(req.url).searchParams.get('diagnostic')==='1'){
    const user=await getUser();
    if(!user||await appRole(user)!=='owner')return Response.json({error:'Somente o proprietário.'},{status:403});
    const e=env as unknown as Record<string,string>;
    const diagnostic:Record<string,unknown>={
      apiKeyPresent:!!e.ASAAS_API_KEY,apiKeyMatchesMode:c.keyMatchesMode,
      webhookTokenPresent:!!e.ASAAS_WEBHOOK_TOKEN,webhookReady:c.webhookReady,
      enabled:e.ASAAS_BILLING_ENABLED==='true',earlyAccess:EARLY_ACCESS_ACTIVE,
      legalConfigured:!!legal,mode:c.mode
    };
    if(new URL(req.url).searchParams.get('probe')==='1'){
      // The probe only lists one customer: it cannot create a charge.
      // Never expose the API key, Asaas response body or payer information.
      if(!c.key){
        diagnostic.apiReachable=false;
        diagnostic.apiIssue='missing_key';
      }else if(!c.keyMatchesMode){
        diagnostic.apiReachable=false;
        diagnostic.apiIssue='environment_mismatch';
      }else{
        try{
          const response=await asaasRequest<{data:unknown[]}>('/customers?limit=1');
          diagnostic.apiReachable=Array.isArray(response.data);
          if(!diagnostic.apiReachable)diagnostic.apiIssue='unexpected_response';
        }catch(error){
          diagnostic.apiReachable=false;
          const message=error instanceof Error?error.message:'';
          const status=/\\((\\d{3})\\)/.exec(message)?.[1];
          if(status){
            const code=Number(status);
            diagnostic.apiHttpStatus=code;
            diagnostic.apiIssue=code===401?'unauthorized':code===403?'forbidden':code===429?'rate_limited':'provider_error';
          }else{
            diagnostic.apiIssue=/tempo limite/i.test(message)?'timeout':'network_error';
          }
        }
      }
    }
    result.diagnostic=diagnostic;
  }
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}
