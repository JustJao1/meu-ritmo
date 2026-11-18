import {getUser} from '../../../session';
import {z} from 'zod';
import {asaasConfig} from '../../../../lib/asaas';
import {priceCents,quoteCoupon} from '../../../../lib/asaas-coupons';

const input=z.object({
  price:z.enum(['plus_month','plus_year','pro_month','pro_year']),
  discountCode:z.string().trim().max(32).optional()
});
export async function POST(req:Request){
  const user=await getUser();
  if(!user)return Response.json({error:'Entre na sua conta.'},{status:401});
  if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Origem inválida.'},{status:403});
  const parsed=input.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return Response.json({error:'Plano ou cupom inválido.'},{status:400});
  const {price,discountCode}=parsed.data;
  const base=priceCents[price];
  // If a coupon was already reserved for this user's active checkout,
  // show its original price so the customer can reopen the SAME checkout.
  const previous=await (await import('cloudflare:workers')).env.DB!.prepare(
    "SELECT o.plan_code,o.coupon_code,o.first_price_cents,o.created_at,h.status AS checkout_status "+
    "FROM asaas_orders o JOIN asaas_hosted_pix_checkouts h ON h.order_id=o.id "+
    "WHERE o.user_id=? AND o.status='pending' AND o.first_paid_at IS NULL "+
    "ORDER BY o.created_at DESC LIMIT 1"
  ).bind(user.userId).first<{
    plan_code:string;coupon_code:string|null;first_price_cents:number;created_at:number;checkout_status:string
  }>();
  if(previous&&previous.plan_code===price&&
    (previous.coupon_code||'')===(discountCode||'').trim().toUpperCase()&&
    previous.checkout_status==='ACTIVE'&&Math.floor(Date.now()/1000)-previous.created_at<3000){
    return Response.json({plan:price,firstAmountCents:previous.first_price_cents,
      renewalAmountCents:base,savingsCents:base-previous.first_price_cents,
      discountApplied:!!previous.coupon_code,interval:price.endsWith('_year')?'year':'month',
      checkoutAvailable:asaasConfig().enabled,resumed:true
    },{headers:{'Cache-Control':'no-store'}});
  }
  let first=base,discountApplied=false;
  if(discountCode){
    try{
      const coupon=await quoteCoupon(price,discountCode,user.userId);
      first=coupon.price;discountApplied=true;
    }catch(e){
      return Response.json({error:e instanceof Error?e.message:'Cupom inválido.'},{status:400,headers:{'Cache-Control':'no-store'}});
    }
  }
  return Response.json({
    plan:price,firstAmountCents:first,renewalAmountCents:base,savingsCents:base-first,
    discountApplied,interval:price.endsWith('_year')?'year':'month',
    checkoutAvailable:asaasConfig().enabled
  },{headers:{'Cache-Control':'no-store'}});
}
