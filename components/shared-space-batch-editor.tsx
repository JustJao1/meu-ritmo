'use client';
import {useState,type FormEvent} from 'react';
import {Plus,Trash2,Check} from 'lucide-react';
import {useLocale} from './language-selector';
import type {Item,Kind} from '../lib/ritmo-domain';

type SharedKind=Extract<Kind,'task'|'event'|'reminder'|'note'|'message'>;
const kinds:SharedKind[]=['task','event','reminder','note','message'];
const names:Record<SharedKind,string>={task:'Tarefa',event:'Compromisso',reminder:'Lembrete',note:'Nota',message:'Recado'};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
const colors=['blue','coral','yellow','pink'] as const;
function empty(type:SharedKind):Item{
 return {id:crypto.randomUUID(),type,title:'',date:today(),time:'',end:'',amount:0,category:'Outros',body:'',color:'blue',repeat:'none',done:false,pinned:false,archived:false,tags:'',days:[],notify:false,checks:[]};
}
export default function SharedSpaceBatchEditor({busy,onSave,onCancel}:{
 busy:boolean;onSave:(items:Item[])=>Promise<boolean>;onCancel:()=>void;
}){
 const {t}=useLocale();
 const [drafts,setDrafts]=useState<Item[]>([empty('task')]);
 const [error,setError]=useState('');
 function add(type:SharedKind){
  if(drafts.length>=25){setError(t('Você pode adicionar até 25 itens de uma vez.'));return;}
  setDrafts(items=>[...items,empty(type)]);
  setError('');
 }
 function patch(id:string,partial:Partial<Item>){
  setDrafts(items=>items.map(item=>item.id===id?{...item,...partial}:item));
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError('');
  const items=drafts.map(item=>({...item,title:item.title.trim(),body:item.body.trim(),tags:item.tags.trim()}));
  if(items.some(item=>!item.title)){setError(t('Preencha o título de todos os itens.'));return;}
  if(items.some(item=>item.type==='reminder'&&!item.time)){setError(t('Defina um horário para cada lembrete.'));return;}
  if(items.some(item=>item.type==='event'&&(!item.time||!item.end||item.end<=item.time))){setError(t('Confira os horários de início e término dos compromissos.'));return;}
  await onSave(items);
 }
 return <form className="shared-batch-editor" onSubmit={e=>void submit(e)}>
  <div className="shared-editor-header"><div><h3>{t('Adicionar vários itens')}</h3><p className="muted">{t('Misture tarefas, compromissos, lembretes, notas e recados. Salve tudo de uma vez.')}</p></div><button type="button" className="secondary" onClick={onCancel}>{t('Cancelar')}</button></div>
  <div className="shared-batch-add" role="group" aria-label={t('Adicionar tipo de item')}>
   {kinds.map(kind=><button type="button" key={kind} onClick={()=>add(kind)} disabled={busy||drafts.length>=25}><Plus size={15}/>{t(names[kind])}</button>)}
  </div>
  <div className="shared-batch-list">{drafts.map((item,i)=><div className="shared-draft" key={item.id}>
   <div className="shared-draft-top"><span>{i+1}. {t(names[item.type as SharedKind])}</span><button type="button" aria-label={t('Remover item')} disabled={busy||drafts.length<=1} onClick={()=>setDrafts(items=>items.filter(x=>x.id!==item.id))}><Trash2 size={16}/></button></div>
   <div className="shared-draft-fields">
    <label>{t('Tipo')}<select value={item.type} onChange={e=>{const type=e.target.value as SharedKind;patch(item.id,{type,time:type==='note'||type==='message'?'':item.time,end:type==='event'?item.end:'',repeat:'none',notify:false,checks:[]})}}>{kinds.map(k=><option key={k} value={k}>{t(names[k])}</option>)}</select></label>
    <label className="shared-field-grow">{t('Título')}<input required maxLength={200} value={item.title} onChange={e=>patch(item.id,{title:e.target.value})} placeholder={t('O que será compartilhado?')}/></label>
   </div>
   {!['note','message'].includes(item.type)&&<div className="shared-draft-fields">
    <label>{t('Data')}<input type="date" required value={item.date} onChange={e=>patch(item.id,{date:e.target.value})}/></label>
    <label>{t('Horário')}<input type="time" required={item.type==='event'||item.type==='reminder'} value={item.time} onChange={e=>patch(item.id,{time:e.target.value})}/></label>
    {item.type==='event'&&<label>{t('Término')}<input type="time" required value={item.end} onChange={e=>patch(item.id,{end:e.target.value})}/></label>}
    {item.type==='task'&&<label>{t('Repetição')}<select value={item.repeat} onChange={e=>patch(item.id,{repeat:e.target.value})}><option value="none">{t('Não repetir')}</option><option value="daily">{t('Todos os dias')}</option><option value="weekly">{t('Toda semana')}</option><option value="monthly">{t('Todo mês')}</option></select></label>}
   </div>}
   <label>{t('Detalhes (opcional)')}<textarea rows={2} maxLength={10000} value={item.body} onChange={e=>patch(item.id,{body:e.target.value})}/></label>
   {['note','message'].includes(item.type)&&<div className="shared-color-row" role="group" aria-label={t('Cor do item')}>{colors.map(color=><button type="button" aria-label={t('Cor')+' '+color} aria-pressed={item.color===color} className={'shared-color shared-color-'+color+(item.color===color?' selected':'')} key={color} onClick={()=>patch(item.id,{color})}/>)}</div>}
  </div>)}</div>
  {error&&<p className="autherror" role="alert">{error}</p>}
  <div className="shared-batch-footer"><span className="muted">{drafts.length} {t('itens para adicionar')}</span><button type="submit" className="primary" disabled={busy}><Check size={17}/>{t('Salvar todos os itens')}</button></div>
 </form>;
}
