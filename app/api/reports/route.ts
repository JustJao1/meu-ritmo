import {getUser} from '../../session';
import {userPlan} from '../../../lib/entitlements';
import {monthExpenses,monthIncome,type Item,type Data} from '../../../lib/ritmo-domain';
import {budgetState} from '../../../lib/budget';
import {env} from 'cloudflare:workers';
const total=(items:Item[])=>Math.round(items.reduce((n,x)=>n+x.amount,0)*100)/100;
const group=(items:Item[])=>Array.from(new Set(items.map(x=>x.category)))
 .map(name=>({name,total:total(items.filter(x=>x.category===name))})).sort((a,b)=>b.total-a.total);
export async function GET(req:Request){
 const u=await getUser();
 if(!u)return Response.json({error:'Entre na sua conta.'},{status:401});
 if(await userPlan(u.userId)!=='pro')return Response.json({error:'Este relatório faz parte do Pro. A exportação completa em JSON continua gratuita.'},{status:403});
 const url=new URL(req.url),month=url.searchParams.get('month')||new Date().toISOString().slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return Response.json({error:'Escolha um mês válido.'},{status:400});
 try{
  const row=await env.DB!.prepare('SELECT payload FROM accounts WHERE user_id=?').bind(u.userId).first<{payload:string}>();
  const data:Data=row?JSON.parse(row.payload):{items:[],budget:2000,onboarded:false,timezone:'America/Sao_Paulo'};
  const months=Array.from({length:6},(_,i)=>{
   const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-5+i);
   const m=d.toISOString().slice(0,7),summary=budgetState(data,m);
   return {month:m,total:summary.total,income:summary.incomeTotal,balance:summary.balance,budget:summary.budget};
  });
  const categories=group(monthExpenses(data.items,month)),incomeCategories=group(monthIncome(data.items,month));
  if(url.searchParams.get('format')==='csv'){
   const money=(value:number)=>value.toFixed(2).replace('.',',');
   const lines=[
    'Mês;Ganhos previstos (R$);Gastos previstos (R$);Saldo previsto (R$);Orçamento (R$)',
    ...months.map(x=>[x.month,x.income,x.total,x.balance,x.budget].map((value,i)=>i===0?String(value):money(Number(value))).join(';')),
    '', 'Categoria de gasto;Total previsto (R$)',
    ...categories.map(x=>x.name+';'+money(x.total)),
    '', 'Categoria de ganho;Total previsto (R$)',
    ...incomeCategories.map(x=>x.name+';'+money(x.total))
   ];
   return new Response(lines.join('\r\n'),{headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':'attachment; filename="meu-ritmo-relatorio.csv"','Cache-Control':'no-store'}});
  }
  return Response.json({months,categories,incomeCategories},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Não foi possível gerar o relatório. Tente novamente.'},{status:503});}
}
