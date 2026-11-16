import {env} from 'cloudflare:workers';
import {getUser} from '../../session';
import {sameOrigin} from '../../../lib/admin-access';
import {socialRate} from '../../../lib/social';
import {feedbackInput,feedbackMessage,feedbackSeen} from '../../../lib/feedback';
const output=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){
 const u=await getUser();if(!u)return output({error:'Entre na sua conta.'},401);
 try{
  if(new URL(req.url).searchParams.get('summary')==='1'){
   const row=await env.DB!.prepare('SELECT count(*) AS unread FROM user_feedback WHERE user_id=? AND unread=1').bind(u.userId).first();return output(row||{unread:0});
  }
  const rows=await env.DB!.prepare('SELECT * FROM user_feedback WHERE user_id=? ORDER BY updated_at DESC LIMIT 100').bind(u.userId).all<any>();
  const messages=await env.DB!.prepare('SELECT m.* FROM feedback_messages m JOIN user_feedback f ON f.id=m.feedback_id WHERE f.user_id=? ORDER BY m.created_at,m.id').bind(u.userId).all<any>();
  return output({entries:rows.results.map(f=>({...f,messages:messages.results.filter(m=>m.feedback_id===f.id)}))});
 }catch{return output({error:'Não foi possível carregar suas opiniões. Tente novamente.'},503);}
}
export async function POST(req:Request){
 const u=await getUser();if(!u)return output({error:'Entre na sua conta.'},401);
 if(!sameOrigin(req))return output({error:'Origem inválida.'},403);
 const raw=await req.text();if(raw.length>10000)return output({error:'Mensagem muito longa.'},413);
 let body:unknown;try{body=JSON.parse(raw);}catch{return output({error:'Dados inválidos.'},400);}
 const p=feedbackInput.or(feedbackMessage).or(feedbackSeen).safeParse(body);if(!p.success)return output({error:'Confira a nota e a mensagem. Use de 10 a 3.000 caracteres na opinião.'},400);
 try{
  const d=p.data,now=Math.floor(Date.now()/1000);
  if(d.action==='create'){
   const existing=await env.DB!.prepare('SELECT user_id FROM user_feedback WHERE id=?').bind(d.id).first<{user_id:string}>();
   if(existing)return existing.user_id===u.userId?output({id:d.id,message:'Opinião já registrada.'}):output({error:'Identificador indisponível.'},409);
   if(!await socialRate(u.userId,'feedback',10,86400))return output({error:'Limite de opiniões por dia atingido. Você pode acompanhar as já enviadas.'},429);
   await env.DB!.prepare('INSERT INTO user_feedback(id,user_id,kind,rating,body,page,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(d.id,u.userId,d.kind,d.rating,d.body,d.page,d.version,now,now).run();
   return output({id:d.id,message:'Opinião recebida. Acompanhe as respostas aqui.'},201);
  }
  const owner=await env.DB!.prepare('SELECT id FROM user_feedback WHERE id=? AND user_id=?').bind(d.id,u.userId).first();if(!owner)return output({error:'Opinião não encontrada.'},404);
  if(d.action==='seen'){await env.DB!.prepare('UPDATE user_feedback SET unread=0 WHERE id=? AND user_id=?').bind(d.id,u.userId).run();return output({ok:true});}
  if(!await socialRate(u.userId,'feedback_reply',30,86400))return output({error:'Aguarde antes de enviar mais mensagens.'},429);
  await env.DB!.batch([
   env.DB!.prepare("INSERT INTO feedback_messages(id,feedback_id,author_role,body,created_at) VALUES (?,?,'user',?,?) ON CONFLICT(id) DO NOTHING").bind(d.messageId,d.id,d.body,now),
   env.DB!.prepare("UPDATE user_feedback SET updated_at=?,status=CASE WHEN status='resolved' THEN 'received' ELSE status END WHERE id=? AND user_id=?").bind(now,d.id,u.userId)
  ]);return output({message:'Mensagem enviada.'});
 }catch{return output({error:'Não foi possível enviar. Sua mensagem continua disponível para tentar novamente.'},503);}
}
