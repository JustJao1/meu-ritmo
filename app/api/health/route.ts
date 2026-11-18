import {env} from 'cloudflare:workers';
import {providerConfig} from '../../../lib/auth-server';
import {asaasConfig} from '../../../lib/asaas';
export const dynamic='force-dynamic';
export async function GET(){
 const headers={'Cache-Control':'no-store, no-cache, must-revalidate'};
 try{
  if(!env.DB)return Response.json({status:'unavailable'}, {status:503,headers});
  const row=await env.DB.prepare('SELECT 1 AS ready').first<{ready:number}>();
  const auth=providerConfig(env);
  const asaas=asaasConfig();
  if(row?.ready!==1||!auth.url||!asaas.apiReady||!asaas.webhookReady||!asaas.enabled||asaas.mode!=='production')
   return Response.json({status:'degraded'}, {status:503,headers});
  return Response.json({status:'ok',checkedAt:new Date().toISOString()}, {headers});
 }catch{
  return Response.json({status:'unavailable'}, {status:503,headers});
 }
}
