import type {Data} from './ritmo-domain';
import {monthExpenses} from './ritmo-domain';
export function budgetState(data:Data,month:string){const total=monthExpenses(data.items,month).reduce((s,x)=>s+x.amount,0),review=data.budgetReviews?.[month];const over=Math.round(total*100)>Math.round(data.budget*100);const reviewed=over&&!!review&&Math.round(review.total*100)===Math.round(total*100)&&Math.round(review.budget*100)===Math.round(data.budget*100);return {total,excess:Math.max(0,total-data.budget),status:over?(reviewed?'reviewed':'over'):'within',review};}
