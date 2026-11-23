import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {stateInput} from '../lib/state-validation.ts';
const out=await build({entryPoints:['lib/budget.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {budgetState,budgetForMonth,financeLimitAlert}=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
const expense=(id,amount,date='2026-11-12',repeat='none')=>({id,type:'expense',title:'Despesa '+id,date,time:'',end:'',amount,category:'Casa',body:'',color:'blue',repeat,done:false,pinned:false,archived:false,tags:'',days:[],notify:false,checks:[]});
const income=(id,amount,date='2026-11-12',repeat='none')=>({...expense(id,amount,date,repeat),type:'income',category:'Salário'});
const data=(items,budget=100)=>({items,budget,onboarded:true,timezone:'America/Sao_Paulo'});
test('ganhos afetam saldo, mas não reduzem as despesas nem ampliam orçamento',()=>{
 const d=data([expense('a',130),income('b',200)]);
 const s=budgetState(d,'2026-11','2026-11-20');
 assert.equal(s.total,130);assert.equal(s.incomeTotal,200);assert.equal(s.balance,70);
 assert.equal(s.budget,100);assert.equal(s.excess,30);assert.equal(s.status,'over');
});
test('recorrências de ganhos e despesas são projetadas igualmente',()=>{
 const d=data([expense('a',25,'2026-10-05','monthly'),income('b',100,'2026-10-05','monthly')]);
 const s=budgetState(d,'2026-11','2026-11-01');
 assert.equal(s.total,25);assert.equal(s.incomeTotal,100);assert.equal(s.balance,75);
 assert.equal(s.expensesToDate,0);assert.equal(s.futureExpenses,25);
});
test('orçamento específico não altera meses anteriores e preserva revisão apenas com mesmo limite',()=>{
 const d={...data([expense('a',120)]),monthlyBudgets:{'2026-11':150}};
 assert.equal(budgetForMonth(d,'2026-11'),150);
 assert.equal(budgetForMonth(d,'2026-10'),100);
 assert.equal(budgetState(d,'2026-11').status,'within');
 assert.equal(budgetState({...d,monthlyBudgets:{'2026-11':100}},'2026-11').status,'over');
 const reviewed={...d,monthlyBudgets:{'2026-11':100},budgetReviews:{'2026-11':{reason:'Conserto urgente da casa',total:120,budget:100,at:new Date().toISOString()}}};
 assert.equal(budgetState(reviewed,'2026-11').status,'reviewed');
 assert.equal(budgetState({...reviewed,monthlyBudgets:{'2026-11':90}},'2026-11').status,'over');
});
test('aviso somente ao aumentar gasto acima do limite, sem alerta em ganho ou redução',()=>{
 const a=expense('a',90);const b=expense('b',30);
 const before=data([a]);const after=data([a,b]);
 const warn=financeLimitAlert(before,after,b,'2026-11-23');
 assert.equal(warn?.excess,20);assert.equal(warn?.crossed,true);
 assert.equal(financeLimitAlert(after,before,{...b,amount:0},'2026-11-23'),null);
 assert.equal(financeLimitAlert(before,data([a,income('b',200)]),income('b',200),'2026-11-23'),null);
 const further=financeLimitAlert(after,data([a,b,expense('c',10)]),expense('c',10),'2026-11-23');
 assert.equal(further?.crossed,false);assert.equal(further?.excess,30);
});
test('dados antigos continuam válidos; orçamentos por mês têm limites',()=>{
 const old={revision:0,data:data([expense('a',50)])};
 assert(stateInput.safeParse(old).success);
 assert(stateInput.safeParse({...old,data:{...old.data,monthlyBudgets:{'2026-11':110}}}).success);
 assert(!stateInput.safeParse({...old,data:{...old.data,monthlyBudgets:{'2026-00':110}}}).success);
 assert(!stateInput.safeParse({...old,data:{...old.data,monthlyBudgets:{'2026-11':0}}}).success);
});
test('interface usa rascunho de orçamento e aviso quando salva uma despesa',()=>{
 const ui=readFileSync(new URL('../app/ritmo.tsx',import.meta.url),'utf8');
 assert.match(ui,/saveItemAndCheckBudget\(modal\)/);
 assert.match(ui,/financeLimitAlert\(before,next,item,today\)/);
 assert.match(ui,/budgetDraft\}/);
 assert.doesNotMatch(ui,/onChange=\{e => change\(\{ \.\.\.data, budget:/);
});
test('relatório inclui entradas, saídas e saldo no endpoint e no componente',()=>{
 const api=readFileSync(new URL('../app/api/reports/route.ts',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../components/premium-studio.tsx',import.meta.url),'utf8');
 for(const word of ['incomeCategories','summary.incomeTotal','summary.balance','summary.budget'])assert(api.includes(word));
 for(const word of ['report.incomeCategories','x.balance','report-comparison'])assert(ui.includes(word));
});
