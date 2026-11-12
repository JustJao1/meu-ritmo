import Ritmo from '../ritmo';
import {requireChatGPTUser} from '../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page(){const user=await requireChatGPTUser('/app');const p=await env.DB!.prepare('SELECT username,name,accepted_at FROM profiles WHERE user_id=?').bind(user.userId).first<any>();if(!p?.username||!p?.name||!p?.accepted_at)redirect('/cadastro');return <Ritmo user={user.fullName?.split(' ')[0]||'você'}/>;}
