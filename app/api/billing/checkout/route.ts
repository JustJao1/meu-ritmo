import {EARLY_ACCESS_ACTIVE} from '../../../../lib/entitlements';
import { getUser } from '../../../session';
import { billingConfig, stripe } from '../../../../lib/billing';
import { env } from 'cloudflare:workers';
export async function POST(req: Request) { if(EARLY_ACCESS_ACTIVE)return Response.json({error:'Durante o acesso antecipado, todos os recursos estão liberados gratuitamente. Nenhuma nova cobrança será iniciada.'},{status:503}); const user = await getUser(); if (!user)
    return Response.json({ error: 'Entre na sua conta.' }, { status: 401 }); if (req.headers.get('origin') !== new URL(req.url).origin)
    return Response.json({ error: 'Origem inválida' }, { status: 403 }); const config = billingConfig(); if (!config.enabled)
    return Response.json({ error: 'Stripe em modo de teste não configurado. Nenhuma cobrança foi feita.' }, { status: 503 }); try {
    const input: any = await req.json();if(!['plus_month','plus_year','pro_month','pro_year'].includes(input.price))return Response.json({error:'Plano inválido.'},{status:400});if(!input.acceptTerms)return Response.json({error:'Leia e aceite os termos da assinatura antes de continuar.'},{status:400});
    const price = config.prices[input.price as keyof typeof config.prices];
    if (!price)
        return Response.json({ error: 'Preço de teste não configurado.' }, { status: 400 });
    if(!await env.DB!.prepare("SELECT value FROM service_settings WHERE key='legal'").first())return Response.json({error:'A identificação comercial ainda não está configurada.'},{status:503});
    const existing = await env.DB!.prepare('SELECT status FROM subscriptions WHERE user_id=?').bind(user.userId).first<{
        status: string;
    }>();
    if (existing?.status === 'active' || existing?.status === 'trialing')
        return Response.json({ error: 'Você já tem uma assinatura ativa. Use o gerenciamento para alterá-la.' }, { status: 409 });
    let customer = await env.DB!.prepare('SELECT customer_id FROM billing_customers WHERE user_id=?').bind(user.userId).first<{
        customer_id: string;
    }>();
    if (!customer) {
        const c = await stripe('customers', { email: user.email, 'metadata[user_id]': user.userId }, 'customer-' + user.userId);
        await env.DB!.prepare('INSERT INTO billing_customers (user_id,customer_id) VALUES (?,?) ON CONFLICT(user_id) DO NOTHING').bind(user.userId, c.id).run();
        customer = { customer_id: c.id };
    }
    let discount:Record<string,string>={};if(input.discountCode){const code=String(input.discountCode).trim().toUpperCase();const d=await env.DB!.prepare('SELECT * FROM discount_codes WHERE code=? AND enabled=1 AND expires_at>?').bind(code,Math.floor(Date.now()/1000)).first<any>();if(!d?.stripe_id||d.plan!=='all'&&!String(input.price).startsWith(d.plan+'_'))return Response.json({error:'Cupom de desconto indisponível para esse plano.'},{status:400});const remote=await stripe('promotion_codes/'+encodeURIComponent(d.stripe_id));if(!remote.active||remote.expires_at&&remote.expires_at<Date.now()/1000||remote.max_redemptions&&remote.times_redeemed>=remote.max_redemptions)return Response.json({error:'Esse cupom expirou ou atingiu o limite.'},{status:400});discount={'discounts[0][promotion_code]':d.stripe_id};}
    const origin = new URL(req.url).origin;
    const session = await stripe('checkout/sessions', {...discount,'metadata[terms_version]':'2026-11-12','metadata[terms_accepted_at]':String(Math.floor(Date.now()/1000)), mode: 'subscription', customer: customer.customer_id, 'line_items[0][price]': price, 'line_items[0][quantity]': '1', success_url: origin + '/app?billing=awaiting_webhook', cancel_url: origin + '/app?billing=canceled', 'subscription_data[metadata][user_id]': user.userId, client_reference_id: user.userId, locale: 'pt-BR' }, 'checkout-' + user.userId + '-' + input.price + '-' + Math.floor(Date.now() / 600000));
    return Response.json({ url: session.url, test:config.mode==='test',mode:config.mode });
}
catch (e: any) {
    return Response.json({ error: e.message }, { status: 502 });
} }
