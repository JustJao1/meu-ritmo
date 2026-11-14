import {env} from 'cloudflare:workers';
import {planConfig} from './plans';
import type {AsaasPlanCode} from './asaas';

export const priceCents:Record<AsaasPlanCode,number>={
  plus_month:Math.round(planConfig.plus.monthly*100),
  plus_year:Math.round(planConfig.plus.yearly*100),
  pro_month:Math.round(planConfig.pro.monthly*100),
  pro_year:Math.round(planConfig.pro.yearly*100)
};
type Coupon={id:string;code:string;plan:string;kind:string;value:number;max_uses:number;expires_at:number;enabled:number};
function normalize(s:string){return s.trim().toUpperCase();}
export function discountedCents(base:number,coupon:Pick<Coupon,'kind'|'value'>):number{
  const difference=coupon.kind==='percent'?Math.round(base*coupon.value/100):coupon.value;
  return Math.max(0,base-difference);
}
export async function quoteCoupon(plan:AsaasPlanCode,raw:string){
  const code=normalize(raw);
  if(!/^[A-Z0-9-]{6,32}$/.test(code))throw Error('Cupom inválido.');
  const c=await env.DB!.prepare('SELECT id,code,plan,kind,value,max_uses,expires_at,enabled FROM discount_codes WHERE code=?').bind(code).first<Coupon>();
  const now=Math.floor(Date.now()/1000);
  if(!c||!c.enabled||c.expires_at<=now||c.plan!=='all'&&!plan.startsWith(c.plan+'_'))throw Error('Cupom indisponível para este plano.');
  if(c.kind!=='percent'&&c.kind!=='amount'||c.kind==='percent'&&(c.value<1||c.value>90)||c.value<=0)throw Error('Configuração do cupom inválida.');
  const counted=await env.DB!.prepare('SELECT count(*) as n FROM asaas_coupon_uses WHERE coupon_id=?').bind(c.id).first<{n:number}>();
  if((counted?.n||0)>=c.max_uses)throw Error('Esse cupom já atingiu o limite de usos.');
  const price=discountedCents(priceCents[plan],c);
  if(price<100)throw Error('Esse desconto não pode ser usado nesta assinatura.');
  return {coupon:c,price};
}
export async function reserveCoupon(orderId:string,userId:string,coupon:Coupon) {
  const now=Math.floor(Date.now()/1000);
  // SQLite/D1 executes a single INSERT statement atomically. Prevent reuses and over-redemption.
  const result=await env.DB!.prepare(`INSERT INTO asaas_coupon_uses(coupon_id,user_id,order_id,used_at)
    SELECT ?,?,?,? WHERE
      (SELECT count(*) FROM asaas_coupon_uses WHERE coupon_id=?) <
      (SELECT max_uses FROM discount_codes WHERE id=? AND enabled=1 AND expires_at>?)
      AND NOT EXISTS (SELECT 1 FROM asaas_coupon_uses WHERE coupon_id=? AND user_id=?)`)
    .bind(coupon.id,userId,orderId,now,coupon.id,coupon.id,now,coupon.id,userId).run();
  if(result.meta.changes!==1)throw Error('Cupom já utilizado ou esgotado.');
}
