import { getChatGPTUser } from '../../../chatgpt-auth';
import { billingConfig, stripe } from '../../../../lib/billing';
import { env } from 'cloudflare:workers';
export async function POST(req: Request) { const user = await getChatGPTUser(); if (!user)
    return Response.json({ error: 'Entre na sua conta.' }, { status: 401 }); if (req.headers.get('origin') !== new URL(req.url).origin)
    return Response.json({ error: 'Origem inválida' }, { status: 403 }); if (!billingConfig().enabled)
    return Response.json({ error: 'Gerenciamento de assinatura ainda não configurado.' }, { status: 503 }); try {
    const row = await env.DB!.prepare('SELECT customer_id FROM billing_customers WHERE user_id=?').bind(user.userId).first<{
        customer_id: string;
    }>();
    if (!row)
        return Response.json({ error: 'Nenhuma assinatura encontrada.' }, { status: 404 });
    const session = await stripe('billing_portal/sessions', { customer: row.customer_id, return_url: new URL(req.url).origin + '/app', locale: 'pt-BR' });
    return Response.json({ url: session.url, test: billingConfig().mode==='test' });
}
catch (e: any) {
    return Response.json({ error: e.message }, { status: 502 });
} }
