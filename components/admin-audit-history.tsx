'use client';

import {useMemo,useState} from 'react';
import {CalendarClock,ChevronDown,ClipboardList,History,Search,Settings2,ShieldCheck,Ticket,Users,X} from 'lucide-react';
import {useLocale} from './language-selector';
import {auditDefinition,auditDetails,auditDetailFields,auditTarget,type AuditEntry,type AuditGroup} from '../lib/admin-audit';

const filters:{id:AuditGroup|'all';label:string}[]=[
 {id:'all',label:'Todas'},
 {id:'access',label:'Contas e acessos'},
 {id:'codes',label:'Códigos e cupons'},
 {id:'community',label:'Comunidade'},
 {id:'settings',label:'Configurações'},
 {id:'other',label:'Outros'}
];
const icons={access:ShieldCheck,codes:Ticket,community:Users,settings:Settings2,other:ClipboardList};

export default function AdminAuditHistory({entries}:{entries:AuditEntry[]}){
 const {t,locale}=useLocale();
 const [filter,setFilter]=useState<AuditGroup|'all'>('all');
 const [query,setQuery]=useState('');
 const normalized=useMemo(()=>entries.map((entry,index)=>({
  ...entry,index,
  definition:auditDefinition(entry.action),
  detail:auditDetails(entry.details),
  targetLabel:auditTarget(entry.target,entry.action)
 })).sort((a,b)=>b.created_at-a.created_at||a.index-b.index),[entries]);
 const counts=useMemo(()=>Object.fromEntries(filters.map(group=>[group.id,group.id==='all'?normalized.length:normalized.filter(entry=>entry.definition.group===group.id).length])),[normalized]);
 const visible=useMemo(()=>normalized.filter(entry=>{
  if(filter!=='all'&&entry.definition.group!==filter)return false;
  const search=query.trim().toLocaleLowerCase();
  if(!search)return true;
  return [entry.definition.label,entry.action,entry.actor_email,entry.target,entry.targetLabel.text,
   ...auditDetailFields(entry.detail).map(field=>field.value)].join(' ').toLocaleLowerCase().includes(search);
 }),[normalized,filter,query]);
 const grouped=useMemo(()=>{
  const groups:{date:string;entries:typeof visible}[]=[];
  for(const entry of visible){
   const date=Number.isFinite(entry.created_at)
    ?new Date(entry.created_at*1000).toLocaleDateString(locale,{timeZone:'America/Sao_Paulo',day:'numeric',month:'long',year:'numeric'})
    :t('Data não informada');
   const last=groups[groups.length-1];
   if(last?.date===date)last.entries.push(entry);
   else groups.push({date,entries:[entry]});
  }
  return groups;
 },[visible,locale,t]);

 return <section className="mr-audit" aria-label={t('Histórico de atividades')}>
  <div className="mr-audit-intro">
   <div className="mr-audit-intro-icon"><History size={21}/></div>
   <div>
    <h2>{t('Histórico de atividades')}</h2>
    <p>{t('Consulte as alterações feitas no Meu Ritmo e quem realizou cada ação. O histórico não pode ser editado.')}</p>
   </div>
   <span className="mr-audit-count">{normalized.length} {t('registros carregados')}</span>
  </div>
  <div className="mr-audit-controls">
   <label className="mr-audit-search">
    <Search size={18} aria-hidden="true"/>
    <span className="sr-only">{t('Buscar neste histórico')}</span>
    <input value={query} maxLength={150} onChange={e=>setQuery(e.target.value)}
     placeholder={t('Buscar por ação, usuário ou referência')}/>
    {query&&<button type="button" onClick={()=>setQuery('')} aria-label={t('Limpar busca do histórico')}><X size={16}/></button>}
   </label>
   <div className="mr-audit-filterbar" role="group" aria-label={t('Filtrar atividades')}>
    {filters.filter(item=>item.id!=='other'||!!counts.other).map(item=><button
      type="button" key={item.id} className={filter===item.id?'is-active':''}
      aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>
      {t(item.label)}<span>{counts[item.id]||0}</span>
    </button>)}
   </div>
  </div>
  <div className="mr-audit-results-header"><span>{visible.length} {t('atividades encontradas')}</span><span><CalendarClock size={14}/>{t('Horário de Brasília')}</span></div>
  {visible.length?<div className="mr-audit-feed">
   {grouped.map(group=><section className="mr-audit-day" key={group.date}>
    <h3 className="mr-audit-date">{group.date}</h3>
    <div className="mr-audit-day-list">{group.entries.map(entry=>{
     const Icon=icons[entry.definition.group];
     const extras=auditDetailFields(entry.detail);
     const dateTime=new Date(entry.created_at*1000).toLocaleTimeString(locale,{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});
     const descriptive=entry.detail.reason??entry.detail.label;
     return <article className={'mr-audit-entry mr-audit-'+entry.definition.group} key={entry.index}>
      <span className="mr-audit-entry-icon" aria-hidden="true"><Icon size={19}/></span>
      <div className="mr-audit-entry-main">
       <div className="mr-audit-entry-title"><h4>{t(entry.definition.label)}</h4><time dateTime={new Date(entry.created_at*1000).toISOString()}>{dateTime}</time></div>
       <p className="mr-audit-entry-target"><strong>{t('Referência')}:</strong> <span>{entry.targetLabel.isTechnical?t(entry.targetLabel.text.split(' ')[0])+' '+entry.target.slice(0,8).toUpperCase():t(entry.targetLabel.text)}</span></p>
       <p className="mr-audit-entry-actor"><span>{t('Realizado por')}</span><strong>{entry.actor_email||t('Usuário não identificado')}</strong></p>
       {(typeof descriptive==='string'||typeof descriptive==='number')&&<p className="mr-audit-entry-reason">{String(descriptive)}</p>}
       <details className="mr-audit-detail">
        <summary>{t('Ver informações do registro')} <ChevronDown size={15}/></summary>
        <dl>
         <div><dt>{t('Ação registrada')}</dt><dd><code>{entry.action}</code></dd></div>
         <div><dt>{t('Referência completa')}</dt><dd className="mr-audit-technical">{entry.target||'—'}</dd></div>
         <div><dt>{t('Data e hora')}</dt><dd>{Number.isFinite(entry.created_at)?new Date(entry.created_at*1000).toLocaleString(locale,{timeZone:'America/Sao_Paulo'}):'—'}</dd></div>
         {extras.map(field=><div key={field.key}><dt>{t(field.label)}</dt><dd>{field.key==='kind'?t(field.value==='post'?'Publicação':field.value==='comment'?'Comentário':field.value):field.value}</dd></div>)}
        </dl>
       </details>
      </div>
     </article>;
    })}</div>
   </section>)}
  </div>:<div className="mr-audit-empty"><Search size={24}/><h3>{t('Nenhuma atividade encontrada')}</h3><p>{normalized.length?t('Experimente outro filtro ou termo de busca.'):t('As próximas atividades administrativas aparecerão aqui.')}</p>{(filter!=='all'||query)&&<button type="button" onClick={()=>{setFilter('all');setQuery('')}}>{t('Limpar filtros')}</button>}</div>}
  <p className="mr-audit-footnote">{t('Esta lista mostra até 100 registros retornados pela busca do painel. Utilize a busca principal para localizar outros registros por e-mail ou referência.')}</p>
 </section>;
}
