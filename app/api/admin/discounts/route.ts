import {getUser} from '../../../session';
import {appRole,sameOrigin,auditStatement} from '../../../../lib/admin-access';
import {asaasConfig} from '../../../../lib/asaas';
import {env} from 'cloudflare:workers';
import {z} from 'zod';

const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const id=z.string().uuid();
const request=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),code:z.string().trim().toUpperCase().regex(/^[A-Z0-9_%!-]{6,32}$/),label:z.string().trim().min(3).max(80),plan:z.enum(['all','plus','pro']),kind:z.enum(['percent','amount']),value:z.number().int().positive().max(1000000),expiresAt:z.number().int(),maxUses:z.number().int().min(1).max(10000)}),
 z.object({action:z.literal('sync'),id}),
 z.object({action:z.literal('toggle'),id,enabled:z.boolean()}),
 z.object({action:z.literal('delete'),id})
]);

export async function GET(req:Request){
 const user=await getUser();
 if(!user||await appRole(user)==='user')return response({error:'Acesso restrito.'},403);
 try{
  const url=new URL(req.url);
  const search=(url.searchParams.get('q')||'').trim().slice(0,80).toUpperCase();
  const page=Math.max(0,Math.min(1000,Number(url.searchParams.get('page'))||0));
  const filter="d.archived_at IS NULL AND (instr(upper(d.code),?)>0 OR instr(upper(d.label),?)>0)";
  const [result,total]=await Promise.all([
   env.DB!.prepare(`SELECT d.id,d.code,d.label,d.plan,d.kind,d.value,d.expires_at,d.max_uses,d.enabled,d.created_at,
      (SELECT COUNT(*) FROM asaas_coupon_uses u WHERE u.coupon_id=d.id) AS used_count
      FROM discount_codes d WHERE ${filter}
      ORDER BY d.created_at DESC,d.id DESC LIMIT 31 OFFSET ?`).bind(search,search,page*30).all(),
   env.DB!.prepare(`SELECT COUNT(*) AS total FROM discount_codes d WHERE ${filter}`).bind(search,search).first<{total:number}>()
  ]);
  const config=asaasConfig();
  return response({discounts:result.results.slice(0,30),total:Number(total?.total)||0,page,hasMore:result.results.length>30,mode:config.mode,configured:config.enabled});
 }catch{
  return response({error:'Não foi possível carregar os cupons. Atualize a página ou tente novamente.'},503);
 }
}

export async function POST(req:Request){
 const user=await getUser();
 if(!user)return response({error:'Entre na sua conta.'},401);
 const role=await appRole(user);
 if(role==='user')return response({error:'Acesso restrito.'},403);
 if(!sameOrigin(req))return response({error:'Origem inválida.'},403);
 let body:unknown;
 try{
  const raw=await req.text();
  if(raw.length>5000)return response({error:'Dados muito longos.'},413);
  body=JSON.parse(raw);
 }catch{return response({error:'Dados inválidos.'},400);}
 const parsed=request.safeParse(body);
 if(!parsed.success){
  const invalidCode=parsed.error.issues.some(issue=>issue.path.includes('code'));
  return response({error:invalidCode?
   'Código inválido. Use de 6 a 32 caracteres: letras, números, hífen (-), _, % ou !.':
   'Confira o desconto, a validade e o limite de usos do cupom.'},400);
 }
 const data=parsed.data;
 const now=Math.floor(Date.now()/1000);
 try{
  if(data.action==='create'){
   if(data.kind==='percent'&&data.value>90||data.expiresAt<=now||data.expiresAt>now+3650*86400)
    return response({error:'Use desconto de até 90% e validade futura de até dez anos.'},400);
   if(await env.DB!.prepare('SELECT code FROM promotions WHERE code=? UNION SELECT code FROM discount_codes WHERE code=?').bind(data.code,data.code).first())
    return response({error:'Esse código já está em uso.'},409);
   const newId=crypto.randomUUID();
   await env.DB!.batch([
    env.DB!.prepare('INSERT INTO code_registry(code,kind,reference_id) VALUES (?,?,?)').bind(data.code,'discount',newId),
    env.DB!.prepare('INSERT INTO discount_codes(id,code,label,plan,kind,value,expires_at,max_uses,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(newId,data.code,data.label,data.plan,data.kind,data.value,data.expiresAt,data.maxUses,now),
    auditStatement(user,'discount_created',data.code,{kind:data.kind,value:data.value})
   ]);
   return response({message:'Cupom criado e disponível na lista.',id:newId});
  }
  if(data.action==='sync')return response({message:'Os cupons são validados diretamente no Meu Ritmo, sem sincronização externa.'});
  const coupon=await env.DB!.prepare('SELECT code FROM discount_codes WHERE id=? AND archived_at IS NULL').bind(data.id).first<{code:string}>();
  if(!coupon)return response({error:'Cupom não encontrado ou já excluído.'},404);
  if(data.action==='delete'){
   if(role!=='owner')return response({error:'Somente o proprietário pode excluir cupons.'},403);
   await env.DB!.batch([
    env.DB!.prepare('UPDATE discount_codes SET enabled=0,archived_at=? WHERE id=? AND archived_at IS NULL').bind(now,data.id),
    auditStatement(user,'discount_deleted',coupon.code,{id:data.id,archivedAt:now})
   ]);
   return response({message:'Cupom excluído. Ele não pode mais ser usado e foi retirado da lista. Compras anteriores foram preservadas.'});
  }
  await env.DB!.batch([
   env.DB!.prepare('UPDATE discount_codes SET enabled=? WHERE id=? AND archived_at IS NULL').bind(data.enabled?1:0,data.id),
   auditStatement(user,data.enabled?'discount_enabled':'discount_disabled',coupon.code,{})
  ]);
  return response({message:'Cupom atualizado.'});
 }catch{
  return response({error:'Não foi possível concluir a alteração. Tente novamente.'},503);
 }
}
