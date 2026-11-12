import { billingConfig, stripe } from '../../../../lib/billing';
import { verifyWebhook } from '../../../../lib/webhook-signature';
import { env } from 'cloudflare:workers';
export async function POST(req: Request) { const config = billingConfig(); if (!config.enabled)
    return Response.json({ error: 'Webhook de teste não configurado.' }, { status: 503 }); const body = await req.text(); if (!await verifyWebhook(body, req.headers.get('stripe-signature') || '', config.webhook))
    return Response.json({ error: 'Assinatura inválida.' }, { status: 400 }); try {
    const event = JSON.parse(body);
    if (event.livemode !== (config.mode==='live'))
        return Response.json({ error: 'O modo do evento não corresponde ao modo configurado.' }, { status: 400 });
    if (await env.DB!.prepare('SELECT event_id FROM webhook_events WHERE event_id=?').bind(event.id).first())
        return Response.json({ received: true });
    if (event.type.startsWith('customer.subscription.')) {
        const sub = await stripe('subscriptions/' + encodeURIComponent(event.data.object.id));
        const customer = await env.DB!.prepare('SELECT user_id FROM billing_customers WHERE customer_id=?').bind(sub.customer).first<{
            user_id: string;
        }>();
        if (!customer)
            return Response.json({ error: 'Cliente ainda não associado.' }, { status: 409 });
        const price = sub.items?.data?.[0]?.price?.id;
        const plan = Object.entries(config.prices).find(([, v]) => v && v === price)?.[0]?.split('_')[0] || 'free';
        await env.DB!.batch([env.DB!.prepare('INSERT INTO subscriptions (user_id,subscription_id,plan,status,updated_at,valid_until) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET subscription_id=excluded.subscription_id,plan=excluded.plan,status=excluded.status,updated_at=excluded.updated_at,valid_until=excluded.valid_until WHERE subscriptions.updated_at<=excluded.updated_at').bind(customer.user_id, sub.id, plan, sub.status, event.created,sub.items?.data?.[0]?.current_period_end||sub.current_period_end||null), env.DB!.prepare('INSERT INTO webhook_events(event_id,received_at) VALUES (?,?) ON CONFLICT(event_id) DO NOTHING').bind(event.id, Date.now())]);
    }
    return Response.json({ received: true });
}
catch {
    return Response.json({ error: 'Falha ao processar. O provedor pode tentar novamente.' }, { status: 500 });
} }
