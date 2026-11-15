import {env} from 'cloudflare:workers';
import {getUser} from '../../../session';
import {appRole} from '../../../../lib/admin-access';

/** Owner-only, read-only ledger. Never returns payment credentials or card details. */
export async function GET(){
  const user=await getUser();
  if(!user||await appRole(user)!=='owner')
    return Response.json({error:'Somente o proprietário pode consultar cobranças.'},{status:403});
  try{
    const [summary,orders]=await Promise.all([
      env.DB!.prepare(`SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(CASE WHEN status='active' THEN 1 ELSE 0 END),0) AS active_orders,
        COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),0) AS pending_orders,
        COALESCE(SUM(CASE WHEN status IN ('creating','review') THEN 1 ELSE 0 END),0) AS review_orders,
        COALESCE(SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END),0) AS cancelled_orders
        FROM asaas_orders`).first(),
      env.DB!.prepare(`SELECT o.id,o.plan_code,o.status,o.first_price_cents,o.base_price_cents,
        o.created_at,o.cancelled_at,o.first_paid_at,m.email,
        COALESCE((SELECT SUM(p.amount_cents) FROM asaas_payments p
          WHERE p.order_id=o.id AND p.status IN ('CONFIRMED','RECEIVED')),0) AS paid_cents,
        (SELECT COUNT(*) FROM asaas_payments p WHERE p.order_id=o.id) AS payment_count
        FROM asaas_orders o LEFT JOIN app_members m ON m.user_id=o.user_id
        ORDER BY o.created_at DESC LIMIT 100`).all()
    ]);
    return Response.json({summary,orders:orders.results},{headers:{'Cache-Control':'private, no-store'}});
  }catch{
    return Response.json({error:'Não foi possível consultar o histórico de cobranças. Confira as migrações do banco.'},{status:503});
  }
}
