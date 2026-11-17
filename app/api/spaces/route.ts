import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getUser} from '../../session';
import {sameOrigin,registerMember} from '../../../lib/admin-access';
import {planAccess} from '../../../lib/entitlements';
import {stateInput} from '../../../lib/state-validation';
import {socialRate} from '../../../lib/social';

const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),name:z.string().trim().min(3).max(64)}),
 z.object({action:z.literal('join'),code:z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{12}$/)}),
 z.object({action:z.literal('rotate'),id:z.string().uuid()}),
 z.object({action:z.literal('rename'),id:z.string().uuid(),name:z.string().trim().min(3).max(64)}),
 z.object({action:z.literal('delete'),id:z.string().uuid(),confirmName:z.string().min(3).max(64)}),
 z.object({action:z.literal('remove'),id:z.string().uuid(),userId:z.string().uuid()}),
 z.object({action:z.literal('leave'),id:z.string().uuid()}),
 z.object({action:z.literal('update'),id:z.string().uuid(),revision:z.number().int().min(0),items:z.unknown()})
]);
const allowed=new Set(['task','event','reminder','note','message']);
const defaultItemData={items:[],budget:2000,onboarded:true,timezone:'America/Sao_Paulo'};
const noStore={'Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:noStore});
const codeAlphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode(){
 const random=crypto.getRandomValues(new Uint8Array(12));
 return Array.from(random,i=>codeAlphabet[i%codeAlphabet.length]).join('');
}
function validItems(value:unknown){
 if(!Array.isArray(value)||value.length>1500)return null;
 const result=stateInput.safeParse({revision:0,data:{...defaultItemData,items:value}});
 if(!result.success)return null;
 if(result.data.data.items.some(i=>!allowed.has(i.type)||i.amount!==0||i.soundAlarm||i.sticker))return null;
 if(JSON.stringify(result.data.data.items).length>800000)return null;
 return result.data.data.items;
}
async function member(userId:string,id:string){
 return env.DB!.prepare('SELECT s.id,s.owner_id,s.name,s.join_code,s.payload,s.revision FROM shared_spaces s JOIN shared_space_members m ON m.space_id=s.id WHERE m.user_id=? AND s.id=?').bind(userId,id).first<any>();
}
async function allowedCreate(user:{userId:string;email:string;displayName:string;fullName:string|null}){
 const entitlement=await planAccess(user.userId);
 // Honor the current Plus or Pro entitlement, including the temporary access campaign.
 return entitlement.plan==='plus'||entitlement.plan==='pro';
}
function view(space:any,userId:string){
 return {id:space.id,name:space.name,owner:space.owner_id===userId,ownerId:space.owner_id,revision:space.revision,joinCode:space.owner_id===userId?space.join_code:undefined};
}
export async function GET(req:Request){
 const user=await getUser();if(!user)return reply({error:'Entre na sua conta.'},401);
 try{
  const id=new URL(req.url).searchParams.get('id');
  const canCreate=await allowedCreate(user);
  if(id){
   if(!z.string().uuid().safeParse(id).success)return reply({error:'Espaço inválido.'},400);
   const s=await member(user.userId,id);if(!s)return reply({error:'Espaço não encontrado ou acesso removido.'},404);
   const users=await env.DB!.prepare('SELECT m.user_id,COALESCE(p.name,a.display_name,\'Membro\') AS name,COALESCE(p.username,\'\') AS username FROM shared_space_members m LEFT JOIN profiles p ON p.user_id=m.user_id LEFT JOIN app_members a ON a.user_id=m.user_id WHERE m.space_id=? ORDER BY m.joined_at').bind(id).all();
   return reply({space:{...view(s,user.userId),items:JSON.parse(s.payload),members:users.results},canCreate});
  }
  const rows=await env.DB!.prepare('SELECT s.id,s.owner_id,s.name,s.join_code,s.revision FROM shared_spaces s JOIN shared_space_members m ON s.id=m.space_id WHERE m.user_id=? ORDER BY s.created_at DESC LIMIT 60').bind(user.userId).all<any>();
  return reply({spaces:rows.results.map(s=>view(s,user.userId)),canCreate,createdCount:rows.results.filter(s=>s.owner_id===user.userId).length,maxCreated:2});
 }catch{return reply({error:'Não foi possível consultar os espaços.'},503);}
}
export async function POST(req:Request){
 const user=await getUser();if(!user)return reply({error:'Entre na sua conta.'},401);
 if(!sameOrigin(req))return reply({error:'Origem inválida.'},403);
 try{
  const raw=await req.text();if(raw.length>850000)return reply({error:'Conteúdo excede o limite do espaço.'},413);
  const parsed=actions.safeParse(JSON.parse(raw));if(!parsed.success)return reply({error:'Confira os dados do espaço.'},400);
  const a=parsed.data,now=Math.floor(Date.now()/1000);
  if(a.action==='create'){
   if(!await allowedCreate(user))return reply({error:'Criar espaços está disponível nos planos Plus e Pro. Participar é gratuito.'},403);
   await registerMember(user);
   const id=crypto.randomUUID();
   for(let attempt=0;attempt<5;attempt++){
    const code=generateCode();
    try{
     const result=await env.DB!.batch([
      env.DB!.prepare('INSERT INTO shared_spaces(id,owner_id,name,join_code,payload,revision,created_at) SELECT ?,?,?,?,?,0,? WHERE (SELECT count(*) FROM shared_spaces WHERE owner_id=?)<2').bind(id,user.userId,a.name,code,'[]',now,user.userId),
      env.DB!.prepare('INSERT INTO shared_space_members(space_id,user_id,joined_at) SELECT id,?,? FROM shared_spaces WHERE id=?').bind(user.userId,now,id)
     ]);
     if(!result[0].meta.changes)return reply({error:'Você já criou 2 espaços. Exclua um dos seus espaços para criar outro.'},409);
     return reply({message:'Espaço criado.',space:{id,name:a.name,joinCode:code,owner:true,ownerId:user.userId,revision:0}},201);
    }catch(error){
     if(!/unique constraint/i.test(String(error)))throw error;
    }
   }
   return reply({error:'Não foi possível gerar um código exclusivo. Tente novamente.'},503);
  }
  if(a.action==='join'){
   if(!await socialRate(user.userId,'space-join',10,900))return reply({error:'Muitas tentativas de convite. Aguarde 15 minutos.'},429);
   await registerMember(user);
   const target=await env.DB!.prepare('SELECT id FROM shared_spaces WHERE join_code=?').bind(a.code).first<{id:string}>();
   if(!target)return reply({error:'Código inválido ou alterado pelo criador.'},404);
   const existing=await member(user.userId,target.id);
   if(existing)return reply({message:'Você já participa deste espaço.',id:target.id});
   const joined=await env.DB!.prepare('INSERT INTO shared_space_members(space_id,user_id,joined_at) SELECT ?,?,? WHERE (SELECT count(*) FROM shared_space_members WHERE space_id=?)<40 ON CONFLICT(space_id,user_id) DO NOTHING').bind(target.id,user.userId,now,target.id).run();
   if(!joined.meta.changes)return reply({error:'Não foi possível entrar: o espaço está cheio ou você já participa.'},409);
   return reply({message:'Você entrou no espaço.',id:target.id});
  }
  const s=await member(user.userId,a.id);
  if(!s)return reply({error:'Espaço não encontrado ou acesso removido.'},404);
  if(a.action==='update'){
   const items=validItems(a.items);if(!items)return reply({error:'Itens inválidos. Compartilhe apenas tarefas, agenda, lembretes, notas e recados.'},400);
   // Only newly introduced IDs generate an alert; edits, deletions and task toggles do not.
   const previousIds=new Set((JSON.parse(s.payload) as Array<{id:string}>).map(item=>item.id));
   const added=items.filter(item=>!previousIds.has(item.id));
   const token=crypto.randomUUID();
   const update=env.DB!.prepare('UPDATE shared_spaces SET payload=?,revision=revision+1,last_change_token=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM shared_space_members WHERE space_id=? AND user_id=?)').bind(JSON.stringify(items),token,s.id,a.revision,s.id,user.userId);
   if(added.length){
    // Same D1 batch/transaction: stale revisions cannot create phantom notifications.
    const notify=env.DB!.prepare(`INSERT INTO shared_space_notifications(id,space_id,recipient_id,actor_id,item_count,item_title,created_at,read_at)
      SELECT lower(hex(randomblob(16))),m.space_id,m.user_id,?,?,?,?,NULL
      FROM shared_space_members m JOIN shared_spaces sp ON sp.id=m.space_id
      WHERE m.space_id=? AND m.user_id<>? AND sp.last_change_token=?`).bind(user.userId,added.length,added[0].title.slice(0,120),now,s.id,user.userId,token);
    const result=await env.DB!.batch([update,notify]);
    if(!result[0].meta.changes)return reply({error:'Outro membro atualizou o espaço. Recarregue antes de editar para não substituir alterações.'},409);
   }else{
    const result=await update.run();
    if(!result.meta.changes)return reply({error:'Outro membro atualizou o espaço. Recarregue antes de editar para não substituir alterações.'},409);
   }
   return reply({revision:a.revision+1,message:added.length?added.length===1?'Item adicionado ao espaço.':added.length+' itens adicionados ao espaço.':'Alterações compartilhadas salvas.',addedCount:added.length});
  }
  if(a.action==='leave'){
   if(s.owner_id===user.userId)return reply({error:'O criador não pode sair enquanto possuir o espaço.'},403);
   await env.DB!.batch([
    env.DB!.prepare('DELETE FROM shared_space_notifications WHERE space_id=? AND recipient_id=?').bind(s.id,user.userId),
    env.DB!.prepare('DELETE FROM shared_space_members WHERE space_id=? AND user_id=?').bind(s.id,user.userId)
   ]);
   return reply({message:'Você saiu do espaço.'});
  }
  if(s.owner_id!==user.userId)return reply({error:'Somente o criador gerencia o convite e os membros.'},403);
  if(a.action==='remove'){
   if(a.userId===user.userId)return reply({error:'O criador não pode se remover.'},400);
   const result=await env.DB!.batch([
    env.DB!.prepare('DELETE FROM shared_space_notifications WHERE space_id=? AND recipient_id=?').bind(s.id,a.userId),
    env.DB!.prepare('DELETE FROM shared_space_members WHERE space_id=? AND user_id=?').bind(s.id,a.userId)
   ]);
   if(!result[1].meta.changes)return reply({error:'Este usuário não participa do espaço.'},404);
   return reply({message:'Participante removido. Seu acesso foi revogado.'});
  }
  if(a.action==='rename'){
   const result=await env.DB!.prepare('UPDATE shared_spaces SET name=? WHERE id=? AND owner_id=?').bind(a.name,s.id,user.userId).run();
   if(!result.meta.changes)return reply({error:'Espaço não encontrado.'},404);
   return reply({message:'Nome do espaço atualizado.',name:a.name});
  }
  if(a.action==='delete'){
   if(a.confirmName!==s.name)return reply({error:'Confirme digitando exatamente o nome do espaço.'},400);
   // The batch is atomic; no member or shared item survives after the space is deleted.
   const result=await env.DB!.batch([
    env.DB!.prepare('DELETE FROM shared_space_notifications WHERE space_id=? AND EXISTS(SELECT 1 FROM shared_spaces WHERE id=? AND owner_id=? AND name=?)').bind(s.id,s.id,user.userId,a.confirmName),
    env.DB!.prepare('DELETE FROM shared_space_members WHERE space_id=? AND EXISTS(SELECT 1 FROM shared_spaces WHERE id=? AND owner_id=? AND name=?)').bind(s.id,s.id,user.userId,a.confirmName),
    env.DB!.prepare('DELETE FROM shared_spaces WHERE id=? AND owner_id=? AND name=?').bind(s.id,user.userId,a.confirmName)
   ]);
   if(!result[2].meta.changes)return reply({error:'Não foi possível excluir. Atualize o espaço e tente novamente.'},409);
   return reply({message:'Espaço excluído definitivamente. Você já pode criar outro.'});
  }
  if(a.action==='rotate'){
   for(let attempt=0;attempt<5;attempt++){
    try{
     const code=generateCode();
     await env.DB!.prepare('UPDATE shared_spaces SET join_code=? WHERE id=? AND owner_id=?').bind(code,s.id,user.userId).run();
     return reply({message:'Novo código criado. O código anterior não funciona mais.',joinCode:code});
    }catch(error){if(!/unique constraint/i.test(String(error)))throw error;}
   }
   return reply({error:'Não foi possível trocar o código agora.'},503);
  }
  return reply({error:'Ação inválida.'},400);
 }catch{return reply({error:'Não foi possível concluir a operação. Confira sua conexão.'},503);}
}
