import {requireUser} from '../session';
import {appRole,registerMember} from '../../lib/admin-access';
import AdminPanel from '../../components/admin-panel';
export const dynamic='force-dynamic';
export default async function AdminPage(){const user=await requireUser('/admin');const role=await appRole(user);if(role==='user')return <main className="adminblocked"><h1>Acesso restrito</h1><p>Sua conta não tem permissão para administrar o Meu Ritmo.</p><a className="primary" href="/app">Voltar ao meu espaço</a></main>;await registerMember(user);return <AdminPanel role={role} email={user.email}/>;}
