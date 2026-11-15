import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getUser} from '../../session';
import {sameOrigin,registerMember} from '../../../lib/admin-access';
import {planAccess} from '../../../lib/entitlements';
import {stateInput} from '../../../lib/state-validation';

const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),name:z.string().trim().min(3).max(64)}),
 z.object({action:z.literal('join'),code:z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{12}$/)}),
 z.object({action:z.literal('rotate'),id:z.string().uuid()}),
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
 // Early-access Pro visuals do not silently grant the paid workspace-creation benefit.
 return entitlement.plan==='pro'&&entitlement.source!=='early_access';
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
  return reply({spaces:rows.results.map(s=>view(s,user.userId)),canCreate});
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
   if(!await allowedCreate(user))return reply({error:'Somente assinantes Pro podem criar espaços. Participar é gratuito.'},403);
   await registerMember(user);
   const count=await env.DB!.prepare('SELECT count(*) n FROM shared_spaces WHERE owner_id=?').bind(user.userId).first<{n:number}>();
   if((count?.n||0)>=10)return reply({error:'Limite de 10 espaços criados atingido.'},409);
   const id=crypto.randomUUID();
   for(let attempt=0;attempt<5;attempt++){
    try{
     const code=generateCode();
     await env.DB!.batch([
      env.DB!.prepare('INSERT INTO shared_spaces(id,owner_id,name,join_code,payload,revision,created_at) VALUES (?,?,?,?,?,0,?)').bind(id,user.userId,a.name,code,'[]',now),
      env.DB!.prepare('INSERT INTO shared_space_members(space_id,user_id,joined_at) VALUES (?,?,?)').bind(id,user.userId,now)
     ]);
     return reply({message:'Espaço criado.',space:{id,name:a.name,joinCode:code,owner:true,revision:0}},201);
    }catch(error){if(!/unique constraint/i.test(String(error)))throw error;}
   }
   return reply({error:'Não foi possível gerar um código exclusivo. Tente novamente.'},503);
  }
  if(a.action==='join'){
   await registerMember(user);
   const target=await env.DB!.prepare('SELECT id FROM shared_spaces WHERE join_code=?').bind(a.code).first<{id:string}>();
   if(!target)return reply({error:'Código inválido ou alterado pelo criador.'},404);
   const existing=await member(user.userId,target.id);
   if(existing)return reply({message:'Você já participa deste espaço.',id:target.id});
   const n=await env.DB!.prepare('SELECT count(*) AS n FROM shared_space_members WHERE space_id=?').bind(target.id).first<{n:number}>();
   if((n?.n||0)>=40)return reply({error:'Este espaço atingiu o limite de 40 participantes.'},409);
   await env.DB!.prepare('INSERT INTO shared_space_members(space_id,user_id,joined_at) VALUES (?,?,?) ON CONFLICT(space_id,user_id) DO NOTHING').bind(target.id,user.userId,now).run();
   return reply({message:'Você entrou no espaço.',id:target.id});
  }
  const s=await member(user.userId,a.id);
  if(!s)return reply({error:'Espaço não encontrado ou acesso removido.'},404);
  if(a.action==='update'){
   const items=validItems(a.items);if(!items)return reply({error:'Itens inválidos. Compartilhe apenas tarefas, agenda, lembretes, notas e recados.'},400);
   const updated=await env.DB!.prepare('UPDATE shared_spaces SET payload=?,revision=revision+1 WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM shared_space_members WHERE space_id=? AND user_id=?)').bind(JSON.stringify(items),s.id,a.revision,s.id,user.userId).run();
   if(!updated.meta.changes)return reply({error:'Outro membro atualizou o espaço. Recarregue antes de editar para não substituir alterações.'},409);
   return reply({revision:a.revision+1,message:'Alterações compartilhadas salvas.'});
  }
  if(a.action==='leave'){
   if(s.owner_id===user.userId)return reply({error:'O criador não pode sair enquanto possuir o espaço.'},403);
   await env.DB!.prepare('DELETE FROM shared_space_members WHERE space_id=? AND user_id=?').bind(s.id,user.userId).run();
   return reply({message:'Você saiu do espaço.'});
  }
  if(s.owner_id!==user.userId)return reply({error:'Somente o criador gerencia o convite e os membros.'},403);
  if(a.action==='remove'){
   if(a.userId===user.userId)return reply({error:'O criador não pode se remover.'},400);
   const result=await env.DB!.prepare('DELETE FROM shared_space_members WHERE space_id=? AND user_id=?').bind(s.id,a.userId).run();
   if(!result.meta.changes)return reply({error:'Este usuário não participa do espaço.'},404);
   return reply({message:'Participante removido. Seu acesso foi revogado.'});
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
