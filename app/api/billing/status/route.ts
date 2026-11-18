import {EARLY_ACCESS_ACTIVE} from '../../../../lib/entitlements';
import {asaasConfig,asaasCardCheckoutReady,asaasRequest} from '../../../../lib/asaas';
import {getUser} from '../../../session';
import {appRole} from '../../../../lib/admin-access';
import {env} from 'cloudflare:workers';
import {parseLegalSettings} from '../../../../lib/legal-settings';
export async function GET(req:Request){
  const c=asaasConfig();
  const legal=await env.DB!.prepare("SELECT value FROM service_settings WHERE key='legal'").first();
  const legalConfigured=!!parseLegalSettings(legal?.value);
  const result:Record<string,unknown>={configured:!EARLY_ACCESS_ACTIVE&&c.enabled&&legalConfigured,cardAvailable:!EARLY_ACCESS_ACTIVE&&legalConfigured&&asaasCardCheckoutReady(),earlyAccess:EARLY_ACCESS_ACTIVE,mode:c.mode,legalConfigured,provider:'asaas',manageAvailable:c.apiReady};
  const user=await getUser();
  if(user){
    // Apenas flags de navegação do próprio usuário. Nenhum dado da cobrança é exposto.
    try{
      const order=await env.DB!.prepare(
        "SELECT o.status,h.status AS pix_status,(SELECT COUNT(*) FROM asaas_card_checkouts c WHERE c.order_id=o.id) AS card_count FROM asaas_orders o "+
        "LEFT JOIN asaas_hosted_pix_checkouts h ON h.order_id=o.id "+
        "WHERE o.user_id=? ORDER BY o.created_at DESC LIMIT 1"
      ).bind(user.userId).first<{status:string;pix_status:string|null;card_count:number}>();
      result.hasPaymentHistory=!!order&&(order.status!=='review'||!!order.pix_status||order.card_count>0);
      result.hasPixToVerify=!!order&&order.status==='pending'&&['ACTIVE','PAID'].includes(order.pix_status||'');
      result.hasPendingPix=!!order&&order.status==='pending'&&order.pix_status==='ACTIVE';
      result.hasFailedCheckout=!!order&&order.status==='review'&&!order.pix_status&&order.card_count===0;
    }catch{
      result.hasPaymentHistory=false;result.hasPixToVerify=false;result.hasPendingPix=false;result.hasFailedCheckout=false;
    }
  }
  if(new URL(req.url).searchParams.get('diagnostic')==='1'){
    if(!user||await appRole(user)!=='owner')return Response.json({error:'Somente o proprietário.'},{status:403});
    const e=env as unknown as Record<string,string>;
    const diagnostic:Record<string,unknown>={
      apiKeyPresent:!!e.ASAAS_API_KEY,apiKeyMatchesMode:c.keyMatchesMode,
      webhookTokenPresent:!!e.ASAAS_WEBHOOK_TOKEN,webhookReady:c.webhookReady,
      enabled:e.ASAAS_BILLING_ENABLED==='true',earlyAccess:EARLY_ACCESS_ACTIVE,
      legalConfigured,mode:c.mode
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
          const status=/\((\d{3})\)/.exec(message)?.[1];
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
