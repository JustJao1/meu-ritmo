'use client';
import {useLocale} from './language-selector';
import {Check,ArrowUpRight,Palette,Layers,ArrowRight} from 'lucide-react';
import {planConfig,type Plan} from '../lib/plans';

const benefits:Record<Plan,string[]>={
 free:[
  'Agenda, tarefas e recorrências básicas',
  'Gastos, orçamento e revisão de excessos',
  'Notas e 3 notas fixadas',
  '5 temas e exportação JSON'
 ],
 plus:[
  'Tudo do Gratuito',
  'Crie até 2 espaços compartilhados',
  '9 temas adicionais, 6 cores e estilo editorial',
  'Distintivos e adesivos de notas',
  'Notas pautadas ou pontilhadas',
  '20 notas fixadas e 12 modelos prontos de rotina'
 ],
 pro:[
  'Tudo do Plus',
  'Assistente inteligente para organizar seu dia',
  'Uma cor de destaque própria',
  '100 notas fixadas',
  'Até 20 modelos pessoais de rotina',
  'Publicação de rotinas personalizadas no Social',
  'Relatório de gastos de 6 meses',
  'Exportação de relatório em CSV'
 ]
};
const descriptions:Record<Plan,string>={
 free:'Para usar todos os dias.',
 plus:'Para deixar com a sua cara.',
 pro:'Para organizar com mais detalhe.'
};

export default function PlanComparison({
 annual,onAnnual,onSelect,onTry,current='free',demo=false,earlyAccess=false,showCurrent=true
}:{
 annual:boolean;onAnnual:(v:boolean)=>void;
 onSelect:(p:Plan)=>void;onTry:(p:Plan)=>void;
 current?:Plan;demo?:boolean;earlyAccess?:boolean;showCurrent?:boolean
}){
 const {t:tr,locale}=useLocale();
 const money=(v:number)=>v.toLocaleString(locale,{style:'currency',currency:'BRL'});
 return <div className="plancomparison">
  {earlyAccess&&<div className="earlyaccessnotice" role="status">
   <strong>{tr('Acesso total liberado por tempo limitado')}</strong>
   <p>{tr('Durante o acesso antecipado, todos podem usar os recursos do Pro gratuitamente. Não é necessário cartão. Os planos abaixo mostram os valores previstos para quando as assinaturas forem disponibilizadas.')}</p>
  </div>}
  <div className="planintro">
   <div>
    <span className="eyebrow">{tr('O ESSENCIAL CONTINUA GRATUITO')}</span>
    <h3>{tr('Mais seu. Mais organizado.')}</h3>
    <p>{tr('Plus cuida dos detalhes do seu espaço. Pro acrescenta o assistente inteligente, modelos próprios e relatórios.')}</p>
   </div>
   <div className="billingtoggle">
    <button aria-pressed={!annual} className={!annual?'active':''} onClick={()=>onAnnual(false)}>{tr('Mensal')}</button>
    <button aria-pressed={annual} className={annual?'active':''} onClick={()=>onAnnual(true)}>{tr('Anual')}</button>
   </div>
  </div>
  <div className="plans">{(Object.entries(planConfig) as [Plan,typeof planConfig.free][]).map(([id,p])=>
   <article key={id} data-plan={id} className="plancard">
    <span className="eyebrow">{tr(p.name)}</span>
    <p>{tr(descriptions[id])}</p>
    <div className="planprice">{money(annual?p.yearly:p.monthly)}<small>/{tr(id==='free'?'sempre':annual?'ano':'mês')}</small></div>
    {annual&&id!=='free'&&<small className="equivalent">{tr('Equivale a')} {money(p.yearly/12)} {tr('por mês.')}</small>}
    <button className="plan-select secondary" onClick={()=>onSelect(id)}>
     {id==='free'?tr('Começar grátis'):tr('Ver benefícios do plano')+' '+p.name}<ArrowUpRight size={16}/>
    </button>
    <ul>{benefits[id].map(f=><li key={f}><Check size={15}/>{tr(f)}</li>)}</ul>
    {id!=='free'&&<button className="plantry" onClick={()=>onTry(id)}>
     {tr(demo?'Experimentar na demonstração':'Explorar na demonstração')+' '+p.name}<ArrowRight size={14}/>
    </button>}
    {showCurrent&&current===id&&<span className="currentplan">{tr(demo?'Plano simulado':'Seu plano atual')}</span>}
   </article>)}
  </div>
  <div className="planprinciples">
   <div><Palette size={21}/><p><strong>{tr('Um visual que combina com você.')}</strong> {tr('Personalização sem bagunçar a navegação.')}</p></div>
   <div><Layers size={21}/><p><strong>{tr('Seu conteúdo continua seu.')}</strong> {tr('Sem assinatura, seus dados ficam disponíveis para leitura, edição básica e exportação.')}</p></div>
  </div>
  <p className="planfoot">{earlyAccess?tr('Acesso antecipado gratuito por tempo limitado, sem cobrança automática ao final da campanha. Os preços dos planos são apresentados para consulta; novas assinaturas estão temporariamente indisponíveis. Notas fixadas são recados no topo; distintivos são decorações do perfil.'):tr('Planos mensais e anuais. O Pix tem renovação manual, e o acesso só é liberado após confirmação do pagamento.')}</p>
 </div>;
}
