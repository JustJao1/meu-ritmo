import type {Data,Item} from './ritmo-domain';
import {monthExpenses,monthIncome} from './ritmo-domain';
const amount=(values:Item[])=>Math.round(values.reduce((s,x)=>s+x.amount,0)*100)/100;
export function budgetForMonth(data:Data,month:string){
 const value=data.monthlyBudgets?.[month];
 return typeof value==='number'&&Number.isFinite(value)&&value>0?value:data.budget;
}
export function budgetState(data:Data,month:string,asOf?:string){
 const expenses=monthExpenses(data.items,month),incomes=monthIncome(data.items,month);
 const total=amount(expenses),incomeTotal=amount(incomes),budget=budgetForMonth(data,month),review=data.budgetReviews?.[month];
 const excess=Math.max(0,Math.round((total-budget)*100)/100),over=excess>0;
 const reviewed=over&&!!review&&Math.round(review.total*100)===Math.round(total*100)&&Math.round(review.budget*100)===Math.round(budget*100);
 const date=asOf??new Intl.DateTimeFormat('en-CA',{timeZone:data.timezone}).format(new Date());
 const expensesToDate=amount(expenses.filter(x=>x.date<=date)),incomeToDate=amount(incomes.filter(x=>x.date<=date));
 return {total,incomeTotal,balance:Math.round((incomeTotal-total)*100)/100,budget,excess,
  expensesToDate,incomeToDate,futureExpenses:Math.max(0,Math.round((total-expensesToDate)*100)/100),
  futureIncome:Math.max(0,Math.round((incomeTotal-incomeToDate)*100)/100),
  status:over?(reviewed?'reviewed':'over'):'within',review};
}
export type FinanceLimitAlert={month:string;excess:number;budget:number;total:number;crossed:boolean;future:boolean};
/** Alert only when a saved expense increases an affected month's projected spending above the limit. */
export function financeLimitAlert(before:Data,after:Data,item:Item,today:string):FinanceLimitAlert|null{
 if(item.type!=='expense')return null;
 const current=today.slice(0,7),start=item.date.slice(0,7);
 for(const month of [current,...(start!==current?[start]:[])]){
  const previous=budgetState(before,month,today),next=budgetState(after,month,today);
  if(next.excess>0&&Math.round(next.total*100)>Math.round(previous.total*100)){
   return {month,excess:next.excess,budget:next.budget,total:next.total,
    crossed:Math.round(previous.total*100)<=Math.round(previous.budget*100),future:next.futureExpenses>0};
  }
 }
 return null;
}
