import {getUser} from '../../session';
import {userPlan} from '../../../lib/entitlements';
import {sameOrigin} from '../../../lib/admin-access';
import {stateInput} from '../../../lib/state-validation';
import {planAssistant} from '../../../lib/assistant-planner';
import {socialRate} from '../../../lib/social';
import {z} from 'zod';
const output=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const input=z.object({command:z.string().trim().min(3).max(2000),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),start:z.string(),end:z.string(),duration:z.number().int().min(5).max(240),data:z.unknown()});
export async function POST(req:Request){
 const u=await getUser();if(!u)return output({error:'Entre na sua conta.'},401);
 if(!sameOrigin(req))return output({error:'Origem inválida.'},403);
 if(await userPlan(u.userId)!=='pro')return output({error:'O assistente inteligente é exclusivo do plano Pro.',code:'PRO_REQUIRED'},403);
 try{
  if(!await socialRate(u.userId,'assistant',30,60))return output({error:'Aguarde um minuto antes de fazer novos pedidos.'},429);
  const raw=await req.text();if(raw.length>1500000)return output({error:'O conteúdo excede o limite de análise.'},413);
  const p=input.safeParse(JSON.parse(raw));if(!p.success)return output({error:'Confira seu pedido e os horários disponíveis.'},400);
  const state=stateInput.safeParse({revision:0,data:p.data.data});if(!state.success)return output({error:'Aguarde seus dados carregarem e confira os registros antes de usar o assistente.'},400);
  const result=planAssistant(p.data.command,state.data.data.items,{...p.data,id:()=>crypto.randomUUID()});
  // Validate every proposed record through the same schema used for manual saves.
  if(result.drafts.length){const replaced=new Set(result.drafts.map(d=>d.replaceId).filter(Boolean));const validated=stateInput.safeParse({revision:0,data:{...state.data.data,items:[...state.data.data.items.filter(x=>!replaced.has(x.id)),...result.drafts.map(d=>d.item)]}});if(!validated.success)return output({error:'Não foi possível montar uma proposta válida. Informe datas, horários e valores de forma mais específica.'},422);}
  return output(result);
 }catch{return output({error:'Não foi possível interpretar agora. Seu texto foi mantido; tente novamente.'},503);}
}
