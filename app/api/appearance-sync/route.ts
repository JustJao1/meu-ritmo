import {env} from 'cloudflare:workers';
import {getUser} from '../../session';
import {defaultAppearance,themes} from '../../../lib/plans';
import {hash} from '../../../lib/auth-server';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Authorization','Access-Control-Max-Age':'600','Cache-Control':'no-store'};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:cors});
export async function OPTIONS(){return new Response(null,{status:204,headers:cors});}
export async function GET(req:Request){
 const token=req.headers.get('authorization')?.replace(/^Bearer /i,'')||'';
 if(!/^[a-f0-9]{64}$/.test(token))return json({error:'Vinculação inválida.'},401);
 try{
  const now=Math.floor(Date.now()/1000);
  const link=await env.DB!.prepare('SELECT user_id FROM appearance_links WHERE token_hash=? AND expires_at>?').bind(await hash(token),now).first<{user_id:string}>();
  if(!link)return json({error:'Vinculação expirada ou revogada.'},401);
  const row=await env.DB!.prepare('SELECT payload FROM accounts WHERE user_id=?').bind(link.user_id).first<{payload:string}>();
  const raw=row?JSON.parse(row.payload)?.appearance:null;
  const selected=themes.find(t=>t.id===raw?.theme)||themes[0];
  const accent=typeof raw?.accent==='string'&&/^#[0-9a-fA-F]{6}$/.test(raw.accent)?raw.accent:selected.accent;
  return json({theme:selected.id,accent,paper:selected.paper,side:selected.side,banner:selected.banner,ink:selected.ink});
 }catch{return json({error:'Não foi possível consultar a aparência.'},503);}
}
export async function POST(req:Request){
 const user=await getUser();if(!user)return json({error:'Entre na sua conta.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Origem inválida.'},403);
 try{
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
  const now=Math.floor(Date.now()/1000);
  await env.DB!.prepare('DELETE FROM appearance_links WHERE user_id=?').bind(user.userId).run();
  await env.DB!.prepare('INSERT INTO appearance_links(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').bind(await hash(token),user.userId,now,now+365*86400).run();
  return json({token,expiresAt:now+365*86400});
 }catch{return json({error:'Não foi possível vincular o Lite.'},503);}
}
export async function DELETE(req:Request){
 const user=await getUser();if(!user)return json({error:'Entre na sua conta.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Origem inválida.'},403);
 try{await env.DB!.prepare('DELETE FROM appearance_links WHERE user_id=?').bind(user.userId).run();return json({revoked:true});}
 catch{return json({error:'Não foi possível desvincular o Lite.'},503);}
}
