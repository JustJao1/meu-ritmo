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
