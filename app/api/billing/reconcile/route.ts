import {getUser} from '../../../session';
import {asaasConfig} from '../../../../lib/asaas';
import {getHostedPixForUser,reconcileHostedPix} from '../../../../lib/asaas-hosted-pix-settlement';
import {socialRate} from '../../../../lib/social';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
/** Authenticated, rate-limited fallback when PAYMENT webhook arrives late.
 * Does not trust the browser redirect or accept a claimed payment amount.
 */
export async function POST(req:Request){
 const user=await getUser();if(!user)return reply({error:'Entre na sua conta.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Origem inválida.'},403);
 if(!asaasConfig().apiReady)return reply({error:'Consulta de pagamento indisponível.'},503);
 if(!await socialRate(user.userId,'hosted-pix-verify',12,60))
  return reply({state:'waiting',message:'Aguarde antes de consultar novamente.'},429);
 try{
  const order=await getHostedPixForUser(user.userId);
  if(!order)return reply({state:'not_found'},404);
  const result=await reconcileHostedPix(order);
  return reply(result);
 }catch{return reply({state:'waiting',message:'Confirmação do Asaas ainda indisponível.'},503);}
}
