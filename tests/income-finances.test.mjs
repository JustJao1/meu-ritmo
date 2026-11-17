import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {monthExpenses,monthIncome} from '../lib/ritmo-domain.ts';
import {stateInput} from '../lib/state-validation.ts';
const item={id:'pay',type:'income',title:'Pagamento de projeto',date:'2026-11-16',time:'',end:'',amount:2500,category:'Freelance',body:'',color:'blue',repeat:'none',done:false,pinned:false,archived:false,tags:'',days:[],notify:false,checks:[]};
const wrap=items=>({revision:0,data:{items,budget:1500,onboarded:true,timezone:'America/Sao_Paulo'}});
test('ganhos são armazenáveis e não contam como despesa',()=>{
 assert(stateInput.safeParse(wrap([item])).success);
 assert.equal(monthIncome([item],'2026-11').reduce((s,x)=>s+x.amount,0),2500);
 assert.equal(monthExpenses([item],'2026-11').length,0);
 assert.equal(monthIncome([{...item,repeat:'monthly'}],'2026-12').length,1);
 assert.equal(monthIncome([item],'2026-10').length,0);
});
test('ganhos devem ter valor positivo e categoria conhecida',()=>{
 for(const amount of [0,-1])assert(!stateInput.safeParse(wrap([{...item,amount}])).success);
 assert(!stateInput.safeParse(wrap([{...item,category:'Desconhecida'}])).success);
});
test('a interface e exportação incorporam os ganhos',()=>{
 const source=readFileSync(new URL('../app/ritmo.tsx',import.meta.url),'utf8');
 for(const needle of ["open('income')","finance-totals","monthIncome(items,financeMonth)","meu-ritmo-financas.csv"])assert(source.includes(needle));
});
test('prévia social horizontal configurada',()=>{
 const layout=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8');
 const preview=readFileSync(new URL('../app/opengraph-image.tsx',import.meta.url),'utf8');
 for(const needle of ['openGraph:','summary_large_image'])assert(layout.includes(needle));
 for(const needle of ['width: 1200, height: 630','image/png'])assert(preview.includes(needle));
});