import {publicProfile} from '../../../lib/social';
import {appRole,registerMember} from '../../../lib/admin-access';
import {planAccess} from '../../../lib/entitlements';
import {userPlan} from '../../../lib/entitlements';
import {paidChangeError} from '../../../lib/plans';
import { getChatGPTUser } from '../../chatgpt-auth';
import { env } from 'cloudflare:workers';
import { stateInput } from '../../../lib/state-validation';
export async function GET() { const u = await getChatGPTUser(); if (!u)
    return Response.json({ error: 'Entre na sua conta.' }, { status: 401 }); try {
    await registerMember(u);
    const row = await env.DB!.prepare('SELECT payload, revision FROM accounts WHERE user_id = ?').bind(u.userId).first<{
        payload: string;
        revision: number;
    }>();
    return Response.json({ data: row ? JSON.parse(row.payload) : null, revision: row?.revision ?? 0,plan:await userPlan(u.userId),role:await appRole(u),profile:await publicProfile(u.userId),access:await planAccess(u.userId) }, { headers: { 'Cache-Control': 'no-store' } });
}
catch {
    return Response.json({ error: 'Não foi possível carregar seus dados. Tente novamente.' }, { status: 503 });
} }
export async function PUT(req: Request) { const u = await getChatGPTUser(); if (!u)
    return Response.json({ error: 'Entre na sua conta.' }, { status: 401 }); if (req.headers.get('origin') !== new URL(req.url).origin)
    return Response.json({ error: 'Origem inválida' }, { status: 403 }); try {
    const raw = await req.text();
    if (raw.length > 1500000)
        return Response.json({ error: 'O conteúdo excede o limite de armazenamento por conta.' }, { status: 413 });
    const parsed = stateInput.safeParse(JSON.parse(raw));
    if (!parsed.success)
        return Response.json({ error: 'Confira os campos: título, valor, datas e horário dos avisos.' }, { status: 400 });
    const { data, revision } = parsed.data;
    const current = await env.DB!.prepare('SELECT payload FROM accounts WHERE user_id=?').bind(u.userId).first<{
        payload: string;
    }>();
    const denied=paidChangeError(data,current?JSON.parse(current.payload):null,await userPlan(u.userId));
    if(denied)return Response.json({error:denied},{status:403});
    const result = await env.DB!.prepare('INSERT INTO accounts (user_id,payload,revision) VALUES (?,?,1) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload, revision=accounts.revision+1 WHERE accounts.revision=?').bind(u.userId, JSON.stringify(data), revision).run();
    if (!result.meta.changes)
        return Response.json({ error: 'Seus dados mudaram em outra aba. Exporte as alterações locais e recarregue antes de editar.' }, { status: 409 });
    return Response.json({ revision: revision + 1 });
}
catch {
    return Response.json({ error: 'Não foi possível salvar. Confira a conexão e tente novamente.' }, { status: 500 });
} }
