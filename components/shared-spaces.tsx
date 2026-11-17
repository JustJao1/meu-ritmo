'use client';
import QuietIllustration from './quiet-illustration';
import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,Check,Copy,Plus,RefreshCw,Trash2,Users,X,CalendarDays,NotebookPen,ListChecks,Clock,MessageSquare} from 'lucide-react';
import {useLocale} from './language-selector';
import type {Item,Kind} from '../lib/ritmo-domain';
import {isDone} from '../lib/ritmo-domain';
import SharedSpaceBatchEditor from './shared-space-batch-editor';
import {useAppDialog} from './app-dialog-provider';

type Member={user_id:string;name:string;username:string};
type Space={id:string;name:string;owner:boolean;ownerId:string;revision:number;joinCode?:string;items?:Item[];members?:Member[]};
const kinds:Kind[]=['task','event','reminder','note','message'];
const newDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
const kindNames:Record<string,string>={task:'Tarefa',event:'Compromisso',reminder:'Lembrete',note:'Nota',message:'Recado'};
const kindIcons:Record<string,typeof ListChecks>={task:ListChecks,event:CalendarDays,reminder:Clock,note:NotebookPen,message:MessageSquare};
function itemDefault(type:Kind):Item{
 const date=newDate();
 return {id:crypto.randomUUID(),type,title:'',date,time:'',end:'',amount:0,category:'Outros',body:'',color:'blue',repeat:'none',done:false,pinned:false,archived:false,tags:'',days:[],notify:false,checks:[]};
}
async function request<T=any>(body?:unknown,id?:string):Promise<T>{
 const url='/api/spaces'+(id?'?id='+encodeURIComponent(id):'');
 const response=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}:{cache:'no-store'});
 const result=await response.json() as T & {error?:string};
 if(!response.ok)throw Error(result.error||'Não foi possível consultar o espaço.');
 return result;
}
export default function SharedSpaces({onPersonal,scheduledBySpace={},unreadBySpace={},onReadSpace,onAdded,targetSpaceId,focusRequest=0}:{onPersonal:()=>void;scheduledBySpace?:Record<string,number>;unreadBySpace?:Record<string,number>;onReadSpace?:(id:string)=>void;onAdded?:(info:{spaceId:string;spaceName:string;count:number;firstTitle:string})=>void;targetSpaceId?:string|null;focusRequest?:number}){
 const {t}=useLocale();
 const dialogs=useAppDialog();
 const [spaces,setSpaces]=useState<Space[]>([]);
 const [selected,setSelected]=useState<Space|null>(null);
 const [canCreate,setCanCreate]=useState(false);
 const [createdCount,setCreatedCount]=useState(0);
 const [maxCreated,setMaxCreated]=useState(2);
 const [name,setName]=useState('');
 const [code,setCode]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [editing,setEditing]=useState<Item|null>(null);
 const [batchOpen,setBatchOpen]=useState(false);
 const [showSettings,setShowSettings]=useState(false);
 const [renameValue,setRenameValue]=useState('');
 const [showMembers,setShowMembers]=useState(false);
 const [filter,setFilter]=useState('all');

 async function list(){
  const result=await request<{spaces:Space[];canCreate:boolean;createdCount:number;maxCreated:number}>();
  setSpaces(result.spaces);setCanCreate(result.canCreate);setCreatedCount(result.createdCount);setMaxCreated(result.maxCreated);
 }
 async function open(id:string){
  const response=await request<{space:Space}>(undefined,id);
  setSelected(response.space);setShowMembers(false);setShowSettings(false);setEditing(null);setBatchOpen(false);setRenameValue(response.space.name);onReadSpace?.(id);
 }
 useEffect(()=>{
  let live=true;
  request<{spaces:Space[];canCreate:boolean;createdCount:number;maxCreated:number}>().then(r=>{
   if(!live)return;
   setSpaces(r.spaces);setCanCreate(r.canCreate);setCreatedCount(r.createdCount);setMaxCreated(r.maxCreated);
  }).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[]);
 useEffect(()=>{
  if(!targetSpaceId)return;
  void open(targetSpaceId).catch(e=>setError(e instanceof Error?e.message:'Não foi possível abrir o espaço.'));
 },[targetSpaceId,focusRequest]);
 useEffect(()=>{
  if(!selected||editing||batchOpen||busy)return;
  const interval=setInterval(()=>{
   request<{space:Space}>(undefined,selected.id).then(r=>{
    setSelected(prev=>prev?.id===r.space.id?r.space:prev);
    if(r.space.revision>selected.revision)onReadSpace?.(r.space.id);
   }).catch(e=>{if(e instanceof Error&&e.message.includes('acesso removido')){setSelected(null);setEditing(null);setError('Seu acesso a este espaço foi removido.');}});
  },20000);
  return()=>clearInterval(interval);
 },[selected?.id,selected?.revision,editing,batchOpen,busy]);
 async function act(action:Record<string,unknown>,after?:(result:any)=>void){
  setBusy(true);setError('');setNotice('');
  try{
   const result=await request<any>(action);
   setNotice(result.message||'Operação concluída.');
   after?.(result);
   return true;
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir.');return false;}
  finally{setBusy(false);}
 }
 async function create(e:FormEvent){e.preventDefault();await act({action:'create',name:name.trim()},r=>{
  setName('');void list().then(()=>open(r.space.id));
 });}
 async function join(e:FormEvent){e.preventDefault();await act({action:'join',code:code.trim().toUpperCase()},r=>{
  setCode('');void list().then(()=>open(r.id));
 });}
 async function saveItem(e:FormEvent){
  e.preventDefault();if(!selected||!editing)return;
  const nextItem={...editing,title:editing.title.trim(),body:editing.body.trim()};
  if(!nextItem.title){setError('Informe um título.');return;}
  if(nextItem.type==='event'&&(!nextItem.time||!nextItem.end||nextItem.end<=nextItem.time)){setError('O compromisso precisa de início e término válidos.');return;}
  if(nextItem.type==='reminder'&&!nextItem.time){setError('Defina um horário para o lembrete.');return;}
  const next=(selected.items||[]).some(i=>i.id===nextItem.id)?(selected.items||[]).map(i=>i.id===nextItem.id?nextItem:i):[...(selected.items||[]),nextItem];
  await update(next);
 }
 async function update(next:Item[]){
  if(!selected)return;
  const oldIds=new Set((selected.items||[]).map(item=>item.id));
  const added=next.filter(item=>!oldIds.has(item.id));
  return await act({action:'update',id:selected.id,revision:selected.revision,items:next},r=>{
   setSelected({...selected,items:next,revision:r.revision});
   setEditing(null);
   if(added.length)onAdded?.({spaceId:selected.id,spaceName:selected.name,count:added.length,firstTitle:added[0].title});
  });
 }
 async function removeItem(item:Item){
  if(!selected||!await dialogs.confirm({title:t('Excluir item compartilhado'),description:t('Este item será excluído para todos os participantes.'),confirmText:t('Excluir item'),intent:'danger'}))return;
  await update((selected.items||[]).filter(i=>i.id!==item.id));
 }
 async function toggleDone(item:Item){
  if(!selected)return;
  await update((selected.items||[]).map(i=>{
   if(i.id!==item.id)return i;
   if(i.repeat!=='none'||i.days.length){const date=newDate(),dates=i.completedDates||[];return {...i,completedDates:dates.includes(date)?dates.filter(x=>x!==date):[...dates,date]};}
   return {...i,done:!i.done};
  }));
 }
 async function renameSpace(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!selected||!selected.owner)return;
  const value=renameValue.trim();
  if(value.length<3||value.length>64){setError('Use um nome de 3 a 64 caracteres.');return;}
  await act({action:'rename',id:selected.id,name:value},()=>{setSelected({...selected,name:value});void list();});
 }
 async function deleteSpace(){
  if(!selected||!selected.owner)return;
  const value=await dialogs.prompt({title:t('Excluir espaço definitivamente'),description:t('Todos os itens e participantes serão removidos. Esta ação não pode ser desfeita.'),label:t('Confirme o nome do espaço'),expectedValue:selected.name,placeholder:t('Nome do espaço'),confirmText:t('Excluir definitivamente'),intent:'danger'});
  if(value===null)return;
  if(value!==selected.name){setError('Nome diferente. O espaço não foi excluído.');return;}
  await act({action:'delete',id:selected.id,confirmName:value},()=>{
   setSelected(null);setBatchOpen(false);setEditing(null);void list();
  });
 }
 async function saveBatch(items:Item[]):Promise<boolean>{
  if(!selected)return false;
  const ok=await update([...(selected.items||[]),...items]);
  if(ok){setBatchOpen(false);setNotice(items.length+' itens adicionados ao espaço.');}
  return !!ok;
 }
 async function refresh(){setBusy(true);try{
  if(selected)await open(selected.id);else await list();
  setError('');setNotice('Informações atualizadas.');
 }catch(e){setError(e instanceof Error?e.message:'Erro ao atualizar.')}finally{setBusy(false);}}
 const visible=(selected?.items||[]).filter(i=>filter==='all'||i.type===filter).sort((a,b)=>Number(b.pinned)-Number(a.pinned));
 const counts=Object.fromEntries(['all',...kinds].map(k=>[k,k==='all'?(selected?.items||[]).length:(selected?.items||[]).filter(i=>i.type===k).length]));
 return <div className="sharedspaces">
  {error&&<p className="autherror" role="alert">{error}</p>}
  {notice&&<p className="muted" role="status">{notice}</p>}
  {loading?<p className="muted">{t('Carregando...')}</p>:selected?<div className="shared-board">
   <div className="shared-header">
    <button type="button" className="secondary" onClick={()=>{setSelected(null);setEditing(null);void list()}}><ArrowLeft size={16}/> {t('Voltar')}</button>
    <button type="button" className="secondary" onClick={()=>void refresh()} disabled={busy}><RefreshCw size={16}/> {t('Atualizar')}</button>
   </div>
   <div className="shared-heading"><div><span className="eyebrow">{selected.owner?t('Criador do espaço'):t('Espaço compartilhado')}</span><h2>{selected.name}</h2><p className="muted">{t('Tarefas, agenda, lembretes, notas e recados são visíveis para todos os participantes. Seus gastos, alarmes e tema continuam pessoais.')}</p></div><div className="shared-heading-actions"><button type="button" className="secondary" onClick={()=>setShowMembers(v=>!v)}><Users size={16}/>{selected.members?.length||0} {t('membros')}</button>{selected.owner&&<button type="button" className="secondary" onClick={()=>setShowSettings(v=>!v)}>{t('Gerenciar espaço')}</button>}</div></div>
   {showSettings&&selected.owner&&<section className="shared-owner-settings" aria-label={t('Configurações do espaço')}>
    <form onSubmit={e=>void renameSpace(e)}><h3>{t('Renomear espaço')}</h3><label>{t('Nome do espaço')}<input required minLength={3} maxLength={64} value={renameValue} onChange={e=>setRenameValue(e.target.value)}/></label><button className="secondary" type="submit" disabled={busy||renameValue.trim()===selected.name}>{t('Salvar nome')}</button></form>
    <div className="shared-delete-area"><h3>{t('Excluir espaço')}</h3><p>{t('Exclui definitivamente tarefas, compromissos, notas, recados e participantes. Não é possível desfazer.')}</p><button type="button" className="shared-danger" disabled={busy} onClick={()=>void deleteSpace()}><Trash2 size={15}/>{t('Excluir espaço definitivamente')}</button></div>
   </section>}
   {showMembers&&<div className="shared-members">
    <h3>{t('Participantes')}</h3>
    {(selected.members||[]).map(member=><div className="shared-member" key={member.user_id}><span>{member.name}{member.username?' · @'+member.username:''}</span>{selected.owner&&member.user_id!==selected.ownerId&&<button type="button" disabled={busy} onClick={async()=>{if(await dialogs.confirm({title:t('Remover participante'),description:t('Deseja remover do espaço?')+' '+member.name,confirmText:t('Remover'),intent:'danger'}))void act({action:'remove',id:selected.id,userId:member.user_id},()=>void open(selected.id))}}>{t('Remover')}</button>}</div>)}
    {selected.owner?<div className="shared-invite"><span><strong>{t('Código de convite')}</strong> <code>{selected.joinCode}</code></span><button type="button" onClick={()=>{if(selected.joinCode)void navigator.clipboard.writeText(selected.joinCode).then(()=>setNotice('Código copiado.'))}}><Copy size={15}/>{t('Copiar')}</button><button disabled={busy} type="button" onClick={async()=>{if(await dialogs.confirm({title:t('Trocar código de convite'),description:t('O código anterior deixará de funcionar. Os participantes atuais continuarão no espaço.'),confirmText:t('Trocar código'),intent:'warning'}))void act({action:'rotate',id:selected.id},()=>void open(selected.id))}}><RefreshCw size={15}/>{t('Trocar código')}</button></div>:<button type="button" className="secondary" disabled={busy} onClick={async()=>{if(await dialogs.confirm({title:t('Sair do espaço'),description:t('Os itens compartilhados continuarão disponíveis para os outros membros.'),confirmText:t('Sair do espaço'),intent:'warning'}))void act({action:'leave',id:selected.id},()=>{setSelected(null);void list()})}}>{t('Sair do espaço')}</button>}
   </div>}
   <div className="shared-toolbar">
    <div className="shared-filter"><span className="shared-filter-title">{t('Filtrar por tipo')}</span><div className="shared-filter-options" role="group" aria-label={t('Filtrar por tipo')}>{(['all',...kinds] as string[]).map(kind=><button type="button" key={kind} className={filter===kind?'is-active':''} aria-pressed={filter===kind} onClick={()=>setFilter(kind)}><span>{kind==='all'?t('Tudo'):t(kindNames[kind])}</span><small>{counts[kind]}</small></button>)}</div></div>
    <button type="button" className="primary" disabled={busy||batchOpen||!!editing} onClick={()=>{setEditing(null);setBatchOpen(true)}}><Plus size={16}/>{t('Adicionar itens')}</button>
   </div>
   {batchOpen&&<SharedSpaceBatchEditor busy={busy} onCancel={()=>setBatchOpen(false)} onSave={saveBatch}/>}

   {editing&&<form className="shared-editor" onSubmit={e=>void saveItem(e)}>
    <div className="shared-editor-header"><h3>{t('Editar item compartilhado')}</h3><button type="button" className="iconbtn" aria-label={t('Fechar')} onClick={()=>setEditing(null)}><X size={16}/></button></div>
    <div className="shared-draft-fields">
     <label>{t('Tipo')}<select value={editing.type} onChange={e=>{const type=e.target.value as Kind;setEditing({...editing,type,time:['note','message'].includes(type)?'':editing.time,end:type==='event'?editing.end:'',notify:false,repeat:'none',checks:type==='task'?editing.checks:[]})}}>{kinds.map(k=><option key={k} value={k}>{t(kindNames[k])}</option>)}</select></label>
     <label className="shared-field-grow">{t('Título')}<input required maxLength={200} value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})}/></label>
    </div>
    {!['note','message'].includes(editing.type)&&<div className="shared-time-row"><label>{t('Data')}<input type="date" required value={editing.date} onChange={e=>setEditing({...editing,date:e.target.value})}/></label><label>{t('Horário')}<input type="time" required={editing.type==='event'||editing.type==='reminder'} value={editing.time} onChange={e=>setEditing({...editing,time:e.target.value})}/></label>{editing.type==='event'&&<label>{t('Término')}<input type="time" required value={editing.end} onChange={e=>setEditing({...editing,end:e.target.value})}/></label>}</div>}
    {!['note','message'].includes(editing.type)&&<label>{t('Repetição')}<select value={editing.repeat} onChange={e=>setEditing({...editing,repeat:e.target.value,completedDates:[]})}><option value="none">{t('Não repetir')}</option><option value="daily">{t('Todos os dias')}</option><option value="weekly">{t('Toda semana')}</option><option value="monthly">{t('Todo mês')}</option></select></label>}
    <label>{t('Detalhes (opcional)')}<textarea maxLength={10000} rows={4} value={editing.body} onChange={e=>setEditing({...editing,body:e.target.value})}/></label>
    <label>{t('Etiquetas (opcional)')}<input maxLength={500} placeholder={t('Ex.: urgente, equipe')} value={editing.tags} onChange={e=>setEditing({...editing,tags:e.target.value})}/></label>
    {editing.type==='task'&&<label>{t('Checklist (uma etapa por linha)')}<textarea rows={4} maxLength={4000} value={editing.checks.join('\n')} onChange={e=>setEditing({...editing,checks:e.target.value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,30)})}/></label>}
    {['note','message'].includes(editing.type)&&<div className="shared-color-row" role="group" aria-label={t('Cor do item')}>{(['blue','coral','yellow','pink'] as const).map(color=><button type="button" key={color} className={'shared-color shared-color-'+color+(editing.color===color?' selected':'')} aria-label={t('Cor')+' '+color} aria-pressed={editing.color===color} onClick={()=>setEditing({...editing,color})}/>)}</div>}
    {editing.type==='note'&&<label className="shared-inline-check"><input type="checkbox" checked={editing.pinned} onChange={e=>setEditing({...editing,pinned:e.target.checked})}/>{t('Fixar nota no início')}</label>}
    <p className="muted">{t('As alterações aparecem para todos. Lembretes compartilhados não acionam alarmes pessoais.')}</p>
    <div className="dialogactions"><button type="button" onClick={()=>setEditing(null)}>{t('Cancelar')}</button><button className="primary" type="submit" disabled={busy}><Check size={15}/>{t('Salvar alterações')}</button></div>
   </form>}
   <div className="shared-items">{visible.length?visible.map(i=>{
    const Icon=kindIcons[i.type]||ListChecks,done=i.type==='task'&&isDone(i,newDate());
    return <article key={i.id} className={'shared-item '+(['note','message'].includes(i.type)?'shared-item-color-'+i.color:'')}>
     <div className="shared-item-icon"><Icon size={19}/></div>
     <div className="shared-item-info">
      <small>{t(kindNames[i.type]||i.type)}{!['note','message'].includes(i.type)?' · '+i.date+(i.time?' · '+i.time:''):''}{i.repeat!=='none'?' · '+t({daily:'Todos os dias',weekly:'Toda semana',monthly:'Todo mês'}[i.repeat]||''):''}{i.pinned?' · '+t('Fixada'):''}</small>
      <strong className={done?'shared-done':''}>{i.title}</strong>
      {i.body&&<p>{i.body}</p>}
      {i.tags&&<small className="shared-item-tags">{i.tags}</small>}
      {i.type==='task'&&i.checks?.length>0&&<ul className="shared-checklist">{i.checks.map((step,index)=><li key={index}>{step}</li>)}</ul>}
     </div>
     <div className="shared-item-actions">
      {i.type==='task'&&<button type="button" title={t(done?'Reabrir':'Concluir')} aria-label={t(done?'Reabrir':'Concluir')} disabled={busy||batchOpen||!!editing} onClick={()=>void toggleDone(i)}><Check size={16}/></button>}
      <button type="button" title={t('Editar')} disabled={busy||batchOpen||!!editing} onClick={()=>setEditing({...i})}>{t('Editar')}</button>
      <button type="button" title={t('Duplicar')} disabled={busy||batchOpen||!!editing} onClick={()=>void update([...(selected.items||[]),{...i,id:crypto.randomUUID(),title:i.title+' ('+t('cópia')+')',done:false,completedDates:[]}])}>{t('Duplicar')}</button>
      <button type="button" aria-label={t('Excluir')} disabled={busy||batchOpen||!!editing} onClick={()=>void removeItem(i)}><Trash2 size={16}/></button>
     </div>
    </article>;
   }):<p className="muted">{t('Nenhum item compartilhado ainda. Adicione o primeiro.')}</p>}</div>
  </div>:<div className="shared-list"><QuietIllustration kind="community"/>
   <p className="muted">{t('Seu espaço pessoal continua privado. Você pode participar de espaços por convite, mesmo no plano gratuito.')}</p>
   <button type="button" className="shared-personal" onClick={onPersonal}><span><strong>{t('Meu espaço')}</strong><small>{t('Pessoal')} · {t('Privado')}</small></span><ArrowLeft size={15}/></button>
   {spaces.map(s=><button type="button" key={s.id} className={'shared-space-entry'+(unreadBySpace[s.id]?' has-unread':'')+(scheduledBySpace[s.id]?' has-scheduled':'')} onClick={()=>{setError('');void open(s.id).catch(e=>setError(e.message))}}><Users size={19}/><span><strong>{s.name}</strong><small>{s.owner?t('Criado por você'):t('Participante')}{unreadBySpace[s.id]?' · '+t('Novidades para ver'):''}{scheduledBySpace[s.id]?' · '+scheduledBySpace[s.id]+' '+t(scheduledBySpace[s.id]===1?'evento agendado':'eventos agendados'):''}</small></span>{scheduledBySpace[s.id]>0&&<b className="mr-shared-space-count" aria-label={scheduledBySpace[s.id]+' '+t('eventos pendentes')}>{scheduledBySpace[s.id]>99?'99+':scheduledBySpace[s.id]}</b>}{unreadBySpace[s.id]>0&&<b className="shared-entry-unread" aria-label={unreadBySpace[s.id]+' '+t('notificações não vistas')}>{unreadBySpace[s.id]>99?'99+':unreadBySpace[s.id]}</b>}<ArrowLeft size={15}/></button>)}
   <div className="shared-columns"><form onSubmit={join} className="shared-box"><h3>{t('Entrar com código')}</h3><p className="muted">{t('Peça o código de convite ao criador do espaço.')}</p><label>{t('Código de convite')}<input required minLength={12} maxLength={12} value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/\s/g,''))} autoComplete="off" placeholder="XXXXXXXXXXXX"/></label><button className="primary" disabled={busy}>{t('Entrar no espaço')}</button></form>
   <form onSubmit={create} className="shared-box"><h3>{t('Criar espaço compartilhado')}</h3><p className="muted">{t('Criar um espaço é exclusivo do plano Pro. Qualquer conta pode participar por convite.')}</p><p className="shared-counter">{t('Espaços criados')}: <strong>{createdCount} / {maxCreated}</strong></p>{canCreate&&createdCount<maxCreated?<><label>{t('Nome do espaço')}<input required minLength={3} maxLength={64} value={name} onChange={e=>setName(e.target.value)} placeholder={t('Ex.: Minha equipe')}/></label><button className="primary" disabled={busy}><Plus size={16}/>{t('Criar espaço')}</button></>:<p className="muted">{canCreate?t('Você atingiu o limite de 2 espaços. Exclua um espaço criado por você para criar outro.'):t('A criação está disponível para assinantes Pro. Você ainda pode entrar em espaços compartilhados.')}</p>}</form></div>
  </div>}
 </div>;
}
