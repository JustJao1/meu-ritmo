import {env} from 'cloudflare:workers';
import {getUser} from '../../../session';
import {appRole,sameOrigin} from '../../../../lib/admin-access';
import {adminFeedbackInput,feedbackKinds,feedbackStatuses} from '../../../../lib/feedback';
const output=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){
 const u=await getUser();if(!u||await appRole(u)==='user')return output({error:'Acesso restrito.'},403);
 try{
  const q=new URL(req.url).searchParams,status=q.get('status'),kind=q.get('kind'),page=Math.max(0,Math.min(10000,Number(q.get('page'))||0));
  if(status&&!feedbackStatuses.includes(status as any)||kind&&!feedbackKinds.includes(kind as any))return output({error:'Filtro inválido.'},400);
  const where='WHERE (? IS NULL OR f.status=?) AND (? IS NULL OR f.kind=?)';
  const rows=await env.DB!.prepare('SELECT f.*,m.email FROM user_feedback f LEFT JOIN app_members m ON m.user_id=f.user_id '+where+' ORDER BY f.updated_at DESC LIMIT 31 OFFSET ?').bind(status,status,kind,kind,Math.floor(page)*30).all<any>();
  const selected=rows.results.slice(0,30);const ids=selected.map(f=>f.id);
  const messages=ids.length?await env.DB!.prepare('SELECT * FROM feedback_messages WHERE feedback_id IN ('+ids.map(()=>'?').join(',')+') ORDER BY created_at,id').bind(...ids).all<any>():{results:[]};
  const stats=await env.DB!.prepare('SELECT count(*) AS total,avg(rating) AS average,sum(CASE WHEN status!=\'resolved\' THEN 1 ELSE 0 END) AS pending FROM user_feedback').first();
  const ratings=await env.DB!.prepare('SELECT rating,count(*) AS count FROM user_feedback GROUP BY rating ORDER BY rating').all();
  return output({entries:selected.map(f=>({...f,messages:messages.results.filter(m=>m.feedback_id===f.id)})),hasMore:rows.results.length>30,stats,ratings:ratings.results});
 }catch{return output({error:'Não foi possível carregar os feedbacks.'},503);}
}
export async function POST(req:Request){
 const u=await getUser();if(!u||await appRole(u)==='user')return output({error:'Acesso restrito.'},403);
 if(!sameOrigin(req))return output({error:'Origem inválida.'},403);
 const raw=await req.text();if(raw.length>10000)return output({error:'Mensagem muito longa.'},413);
 let body:unknown;try{body=JSON.parse(raw);}catch{return output({error:'Dados inválidos.'},400);}
 const p=adminFeedbackInput.safeParse(body);if(!p.success)return output({error:'Confira a resposta e o status.'},400);
 try{
  const d=p.data;const row=await env.DB!.prepare('SELECT id FROM user_feedback WHERE id=?').bind(d.id).first();if(!row)return output({error:'Opinião não encontrada.'},404);
  const now=Math.floor(Date.now()/1000);
  if(await env.DB!.prepare('SELECT id FROM app_audit WHERE id=?').bind(d.messageId).first())return output({message:'Atualização já registrada.'});
  await env.DB!.batch([
   ...(d.body?[env.DB!.prepare("INSERT INTO feedback_messages(id,feedback_id,author_role,body,created_at) VALUES (?,?,'admin',?,?) ON CONFLICT(id) DO NOTHING").bind(d.messageId,d.id,d.body,now)]:[]),
   env.DB!.prepare('UPDATE user_feedback SET status=?,unread=1,updated_at=? WHERE id=?').bind(d.status,now,d.id),
   env.DB!.prepare('INSERT INTO app_audit(id,actor_id,actor_email,action,target,details,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(d.messageId,u.userId,u.email,'feedback_updated',d.id,JSON.stringify({status:d.status,replied:!!d.body}),now)
  ]);return output({message:'Atualização enviada. A pessoa será avisada no site.'});
 }catch{return output({error:'Não foi possível salvar a resposta.'},503);}
}
