import {env} from 'cloudflare:workers';
import {getUser} from '../../../session';
import {sameOrigin,appRole} from '../../../../lib/admin-access';
import {adminSupportReply,supportStatuses} from '../../../../lib/support';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){
 const user=await getUser();if(!user||await appRole(user)==='user')return json({error:'Acesso restrito.'},403);
 try{
  const q=new URL(req.url).searchParams,status=q.get('status')||'',page=Math.max(0,Math.min(1000,Number(q.get('page'))||0));
  if(status&&!supportStatuses.includes(status as any))return json({error:'Status inválido.'},400);
  const result=await env.DB!.prepare("SELECT t.*,m.email FROM support_tickets t LEFT JOIN app_members m ON m.user_id=t.user_id WHERE (?='' OR t.status=?) ORDER BY t.updated_at DESC LIMIT 31 OFFSET ?").bind(status,status,page*30).all<any>();
  const tickets=result.results.slice(0,30),ids=tickets.map(x=>x.id);
  const messages=ids.length?await env.DB!.prepare('SELECT * FROM support_messages WHERE ticket_id IN ('+ids.map(()=>'?').join(',')+') ORDER BY created_at,id').bind(...ids).all<any>():{results:[]};
  const stats=await env.DB!.prepare("SELECT count(*) total,sum(CASE WHEN status!='closed' THEN 1 ELSE 0 END) pending FROM support_tickets").first();
  return json({tickets:tickets.map(t=>({...t,messages:messages.results.filter(m=>m.ticket_id===t.id)})),hasMore:result.results.length>30,stats});
 }catch{return json({error:'Não foi possível carregar a fila de atendimento.'},503);}
}
export async function POST(req:Request){
 const user=await getUser();if(!user||await appRole(user)==='user')return json({error:'Acesso restrito.'},403);
 if(!sameOrigin(req))return json({error:'Origem inválida.'},403);
 const raw=await req.text();if(raw.length>9000)return json({error:'Dados muito longos.'},413);
 let body:unknown;try{body=JSON.parse(raw)}catch{return json({error:'Dados inválidos.'},400)}
 const p=adminSupportReply.safeParse(body);if(!p.success)return json({error:'Revise o status e a resposta.'},400);
 const d=p.data,now=Math.floor(Date.now()/1000);
 try{
  const existing=await env.DB!.prepare('SELECT id FROM support_tickets WHERE id=?').bind(d.id).first();
  if(!existing)return json({error:'Protocolo não encontrado.'},404);
  if(await env.DB!.prepare('SELECT id FROM app_audit WHERE id=?').bind(d.messageId).first())return json({message:'Atualização já registrada.'});
  await env.DB!.batch([
   ...(d.body?[env.DB!.prepare("INSERT INTO support_messages(id,ticket_id,author_role,body,created_at) VALUES (?,?,'admin',?,?) ON CONFLICT(id) DO NOTHING").bind(d.messageId,d.id,d.body,now)]:[]),
   env.DB!.prepare('UPDATE support_tickets SET status=?,unread_user=CASE WHEN ? THEN 1 ELSE unread_user END,updated_at=? WHERE id=?').bind(d.status,Boolean(d.body)?1:0,now,d.id),
   env.DB!.prepare('INSERT INTO app_audit(id,actor_id,actor_email,action,target,details,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(d.messageId,user.userId,user.email,'support_updated',d.id,JSON.stringify({status:d.status,replied:!!d.body}),now)
  ]);
  return json({message:'Atendimento atualizado. A resposta está disponível para o usuário.'});
 }catch{return json({error:'Não foi possível responder ao protocolo.'},503);}
}
