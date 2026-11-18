import {env} from 'cloudflare:workers';
import {getUser} from '../../session';
import {sameOrigin} from '../../../lib/admin-access';
import {socialRate} from '../../../lib/social';
import {supportCreate,supportReply,supportSeen} from '../../../lib/support';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){
 const user=await getUser();if(!user)return json({error:'Entre na sua conta.'},401);
 try{
  const summary=new URL(req.url).searchParams.get('summary')==='1';
  if(summary){const row=await env.DB!.prepare('SELECT count(*) AS unread FROM support_tickets WHERE user_id=? AND unread_user=1').bind(user.userId).first();return json({unread:Number(row?.unread)||0});}
  const rows=await env.DB!.prepare('SELECT * FROM support_tickets WHERE user_id=? ORDER BY updated_at DESC LIMIT 70').bind(user.userId).all<any>();
  const ids=rows.results.map(x=>x.id);
  const messages=ids.length?await env.DB!.prepare('SELECT * FROM support_messages WHERE ticket_id IN ('+ids.map(()=>'?').join(',')+') ORDER BY created_at,id').bind(...ids).all<any>():{results:[]};
  return json({tickets:rows.results.map(t=>({...t,messages:messages.results.filter(m=>m.ticket_id===t.id)}))});
 }catch{return json({error:'Não foi possível consultar seus atendimentos.'},503);}
}
export async function POST(req:Request){
 const user=await getUser();if(!user)return json({error:'Entre na sua conta.'},401);
 if(!sameOrigin(req))return json({error:'Origem inválida.'},403);
 const raw=await req.text();if(raw.length>9500)return json({error:'Mensagem muito longa.'},413);
 let data:unknown;try{data=JSON.parse(raw)}catch{return json({error:'Dados inválidos.'},400)}
 const parsed=supportCreate.or(supportReply).or(supportSeen).safeParse(data);
 if(!parsed.success)return json({error:'Confira o assunto e a mensagem.'},400);
 const d=parsed.data,now=Math.floor(Date.now()/1000);
 try{
  if(d.action==='create'){
   const existing=await env.DB!.prepare('SELECT user_id FROM support_tickets WHERE id=?').bind(d.id).first<{user_id:string}>();
   if(existing)return existing.user_id===user.userId?json({id:d.id,message:'Atendimento já registrado.'}):json({error:'Identificador indisponível.'},409);
   if(!await socialRate(user.userId,'support',5,86400))return json({error:'Limite de novos atendimentos por dia atingido. Responda a um protocolo existente.'},429);
   await env.DB!.batch([
    env.DB!.prepare('INSERT INTO support_tickets(id,user_id,category,subject,status,created_at,updated_at) VALUES (?,?,?,? ,\'open\',?,?)').bind(d.id,user.userId,d.category,d.subject,now,now),
    env.DB!.prepare("INSERT INTO support_messages(id,ticket_id,author_role,body,created_at) VALUES (?,?,'user',?,?)").bind(crypto.randomUUID(),d.id,d.body,now)
   ]);return json({id:d.id,message:'Pedido recebido. Acompanhe o protocolo na área Atendimento.'},201);
  }
  const ticket=await env.DB!.prepare('SELECT id,status FROM support_tickets WHERE id=? AND user_id=?').bind(d.id,user.userId).first<{id:string;status:string}>();
  if(!ticket)return json({error:'Atendimento não encontrado.'},404);
  if(d.action==='seen'){await env.DB!.prepare('UPDATE support_tickets SET unread_user=0 WHERE id=? AND user_id=?').bind(d.id,user.userId).run();return json({ok:true});}
  if(!await socialRate(user.userId,'support_reply',30,86400))return json({error:'Aguarde antes de enviar mais mensagens.'},429);
  await env.DB!.batch([
   env.DB!.prepare("INSERT INTO support_messages(id,ticket_id,author_role,body,created_at) VALUES (?,?,'user',?,?) ON CONFLICT(id) DO NOTHING").bind(d.messageId,d.id,d.body,now),
   env.DB!.prepare("UPDATE support_tickets SET status=CASE WHEN status='closed' THEN 'open' ELSE 'open' END,updated_at=? WHERE id=? AND user_id=?").bind(now,d.id,user.userId)
  ]);
  return json({message:'Mensagem enviada.'});
 }catch{return json({error:'Não foi possível registrar o atendimento. Tente novamente.'},503);}
}
