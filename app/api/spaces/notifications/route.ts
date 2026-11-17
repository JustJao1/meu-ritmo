import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getUser} from '../../../session';
import {sameOrigin} from '../../../../lib/admin-access';

const noStore={'Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:noStore});
const readInput=z.object({action:z.literal('read'),spaceId:z.string().uuid()});
type ActivityRow={id:string;spaceId:string;spaceName:string;actorName:string;itemCount:number;itemTitle:string;createdAt:number};
type CountRow={spaceId:string;count:number};
type ScheduledRow={spaceId:string;spaceName:string;payload:string};

export async function GET(){
 const user=await getUser();
 if(!user)return reply({error:'Entre na sua conta.'},401);
 try{
  const [activities,counts,scheduled]=await Promise.all([
   env.DB!.prepare(`SELECT n.id,n.space_id AS spaceId,s.name AS spaceName,
     COALESCE(p.name,a.display_name,'Participante') AS actorName,
     n.item_count AS itemCount,n.item_title AS itemTitle,n.created_at AS createdAt
     FROM shared_space_notifications n
     JOIN shared_spaces s ON s.id=n.space_id
     JOIN shared_space_members m ON m.space_id=n.space_id AND m.user_id=n.recipient_id
     LEFT JOIN profiles p ON p.user_id=n.actor_id
     LEFT JOIN app_members a ON a.user_id=n.actor_id
     WHERE n.recipient_id=? AND n.read_at IS NULL
     ORDER BY n.created_at DESC,n.id DESC LIMIT 80`).bind(user.userId).all<ActivityRow>(),
   env.DB!.prepare(`SELECT n.space_id AS spaceId, count(*) AS count
     FROM shared_space_notifications n JOIN shared_space_members m
     ON m.space_id=n.space_id AND m.user_id=n.recipient_id
     WHERE n.recipient_id=? AND n.read_at IS NULL GROUP BY n.space_id`).bind(user.userId).all<CountRow>(),
   env.DB!.prepare(`SELECT s.id AS spaceId,s.name AS spaceName,j.value AS payload
     FROM shared_spaces s
     JOIN shared_space_members m ON m.space_id=s.id
     JOIN json_each(s.payload) j
     WHERE m.user_id=? AND json_extract(j.value,'$.type') IN ('event','reminder','task')
       AND json_extract(j.value,'$.time') IS NOT NULL AND json_extract(j.value,'$.time')<>''
       AND coalesce(json_extract(j.value,'$.archived'),0)=0
       AND coalesce(json_extract(j.value,'$.enabled'),1)<>0
     LIMIT 300`).bind(user.userId).all<ScheduledRow>()
  ]);
  const unreadBySpace=Object.fromEntries((counts.results||[]).map(r=>[r.spaceId,r.count]));
  const unreadTotal=(counts.results||[]).reduce((sum,r)=>sum+r.count,0);
  const schedule=(scheduled.results||[]).flatMap(row=>{
   try{
    const item=JSON.parse(row.payload);
    return item&&typeof item.id==='string'&&typeof item.date==='string'&&typeof item.time==='string'&&item.time? [{spaceId:row.spaceId,spaceName:row.spaceName,item}]:[];
   }catch{return [];}
  });
  return reply({notifications:activities.results||[],unreadBySpace,unreadTotal,schedule});
 }catch{return reply({error:'Não foi possível carregar as novidades dos espaços.'},503);}
}

export async function POST(req:Request){
 const user=await getUser();
 if(!user)return reply({error:'Entre na sua conta.'},401);
 if(!sameOrigin(req))return reply({error:'Origem inválida.'},403);
 try{
  const raw=await req.text();
  if(raw.length>1000)return reply({error:'Solicitação inválida.'},413);
  const parsed=readInput.safeParse(JSON.parse(raw));
  if(!parsed.success)return reply({error:'Espaço inválido.'},400);
  const {spaceId}=parsed.data;
  const member=await env.DB!.prepare('SELECT 1 AS ok FROM shared_space_members WHERE space_id=? AND user_id=?').bind(spaceId,user.userId).first();
  if(!member)return reply({error:'Espaço não encontrado ou acesso removido.'},404);
  await env.DB!.prepare('UPDATE shared_space_notifications SET read_at=? WHERE space_id=? AND recipient_id=? AND read_at IS NULL').bind(Math.floor(Date.now()/1000),spaceId,user.userId).run();
  return reply({message:'Novidades conferidas.'});
 }catch{return reply({error:'Não foi possível marcar as novidades como vistas.'},503);}
}
