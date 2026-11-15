'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,Check,Copy,Plus,RefreshCw,Trash2,Users,X,CalendarDays,NotebookPen,ListChecks,Clock,MessageSquare} from 'lucide-react';
import {useLocale} from './language-selector';
import type {Item,Kind} from '../lib/ritmo-domain';
import {isDone} from '../lib/ritmo-domain';
import SharedSpaceBatchEditor from './shared-space-batch-editor';

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
export default function SharedSpaces({onPersonal}:{onPersonal:()=>void}){
 const {t}=useLocale();
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
  setSelected(response.space);setShowMembers(false);setShowSettings(false);setEditing(null);setBatchOpen(false);setRenameValue(response.space.name);
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
  if(!selected||editing||batchOpen||busy)return;
  const interval=setInterval(()=>{
   request<{space:Space}>(undefined,selected.id).then(r=>{
    setSelected(prev=>prev?.id===r.space.id?r.space:prev);
   }).catch(e=>{if(e instanceof Error&&e.message.includes('acesso removido')){setSelected(null);setEditing(null);setError('Seu acesso a este espaço foi removido.');}});
  },20000);
  return()=>clearInterval(interval);
 },[selected?.id,editing,batchOpen,busy]);
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
  return await act({action:'update',id:selected.id,revision:selected.revision,items:next},r=>{
   setSelected({...selected,items:next,revision:r.revision});
   setEditing(null);
  });
 }
 async function removeItem(item:Item){
  if(!selected||!confirm('Excluir este item para todos os participantes?'))return;
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
  const value=window.prompt('Para excluir definitivamente o espaço e todos os itens compartilhados, digite exatamente: '+selected.name);
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
   <div className="shared-heading"><div><span className="eyebrow">{selected.owner?t('Criador do espaço'):t('Espaço compartilhado')}</span><h2>{selected.name}</h2><p className="muted">{t('Tarefas, agenda, lembretes, notas e recados são visíveis para todos os participantes. Seus gastos, alarmes e tema continuam pessoais.')}</p></div><button type="button" className="secondary" onClick={()=>setShowMembers(v=>!v)}><Users size={16}/>{selected.members?.length||0} {t('membros')}</button></div>
   {showMembers&&<div className="shared-members">
    <h3>{t('Participantes')}</h3>
    {(selected.members||[]).map(member=><div className="shared-member" key={member.user_id}><span>{member.name}{member.username?' · @'+member.username:''}</span>{selected.owner&&member.user_id!==selected.ownerId&&<button type="button" disabled={busy} onClick={()=>{if(confirm('Remover '+member.name+' deste espaço?'))void act({action:'remove',id:selected.id,userId:member.user_id},()=>void open(selected.id))}}>{t('Remover')}</button>}</div>)}
    {selected.owner?<div className="shared-invite"><span><strong>{t('Código de convite')}</strong> <code>{selected.joinCode}</code></span><button type="button" onClick={()=>{if(selected.joinCode)void navigator.clipboard.writeText(selected.joinCode).then(()=>setNotice('Código copiado.'))}}><Copy size={15}/>{t('Copiar')}</button><button disabled={busy} type="button" onClick={()=>{if(confirm('Gerar outro código? O anterior deixará de funcionar.'))void act({action:'rotate',id:selected.id},()=>void open(selected.id))}}><RefreshCw size={15}/>{t('Trocar código')}</button></div>:<button type="button" className="secondary" disabled={busy} onClick={()=>{if(confirm('Sair deste espaço? Os itens continuarão para os demais membros.'))void act({action:'leave',id:selected.id},()=>{setSelected(null);void list()})}}>{t('Sair do espaço')}</button>}
   </div>}
   <div className="shared-toolbar"><label>{t('Mostrar')} <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{t('Tudo')}</option>{kinds.map(k=><option key={k} value={k}>{t(kindNames[k])}</option>)}</select></label><button type="button" className="primary" onClick={()=>setEditing(itemDefault('task'))}><Plus size={16}/>{t('Adicionar item')}</button></div>
   {editing&&<form className="shared-editor" onSubmit={e=>void saveItem(e)}>
    <div className="shared-editor-header"><h3>{t('Editar item compartilhado')}</h3><button type="button" className="iconbtn" aria-label={t('Fechar')} onClick={()=>setEditing(null)}><X size={16}/></button></div>
    <label>{t('Tipo')}<select value={editing.type} onChange={e=>setEditing({...editing,type:e.target.value as Kind,notify:false,time:e.target.value==='note'?'':editing.time})}>{kinds.map(k=><option key={k} value={k}>{t(kindNames[k])}</option>)}</select></label>
    <label>{t('Título')}<input required maxLength={200} value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})}/></label>
    {!['note','message'].includes(editing.type)&&<div className="shared-time-row"><label>{t('Data')}<input type="date" required value={editing.date} onChange={e=>setEditing({...editing,date:e.target.value})}/></label><label>{t('Horário')}{editing.type==='task'?' (opcional)':''}<input type="time" required={editing.type==='event'||editing.type==='reminder'} value={editing.time} onChange={e=>setEditing({...editing,time:e.target.value})}/></label>{editing.type==='event'&&<label>{t('Término')}<input type="time" required value={editing.end} onChange={e=>setEditing({...editing,end:e.target.value})}/></label>}</div>}
    <label>{t('Detalhes (opcional)')}<textarea maxLength={10000} rows={3} value={editing.body} onChange={e=>setEditing({...editing,body:e.target.value})}/></label>
    <p className="muted">{t('Ao salvar, todos os participantes verão a alteração. O lembrete compartilhado não aciona alarmes individuais.')}</p>
    <div className="dialogactions"><button type="button" onClick={()=>setEditing(null)}>{t('Cancelar')}</button><button className="primary" type="submit" disabled={busy}><Check size={15}/>{t('Salvar para todos')}</button></div>
   </form>}
   <div className="shared-items">{visible.length?visible.map(i=>{const Icon=kindIcons[i.type]||ListChecks;return <article key={i.id} className="shared-item"><div className="shared-item-icon"><Icon size={19}/></div><div className="shared-item-info"><small>{t(kindNames[i.type]||i.type)}{!['note','message'].includes(i.type)?' · '+i.date+(i.time?' · '+i.time:''):''}</small><strong className={i.done?'shared-done':''}>{i.title}</strong>{i.body&&<p>{i.body}</p>}</div><div className="shared-item-actions">{i.type==='task'&&<button type="button" title={t('Concluir')} disabled={busy} onClick={()=>void toggleDone(i)}><Check size={16}/></button>}<button type="button" title={t('Editar')} onClick={()=>setEditing(i)}>{t('Editar')}</button><button type="button" aria-label={t('Excluir')} disabled={busy} onClick={()=>void removeItem(i)}><Trash2 size={16}/></button></div></article>}):<p className="muted">{t('Nenhum item compartilhado ainda. Adicione o primeiro.')}</p>}</div>
  </div>:<div className="shared-list">
   <p className="muted">{t('Seu espaço pessoal continua privado. Você pode participar de espaços por convite, mesmo no plano gratuito.')}</p>
   <button type="button" className="shared-personal" onClick={onPersonal}><span><strong>{t('Meu espaço')}</strong><small>{t('Pessoal')} · {t('Privado')}</small></span><ArrowLeft size={15}/></button>
   {spaces.map(s=><button type="button" key={s.id} className="shared-space-entry" onClick={()=>{setError('');void open(s.id).catch(e=>setError(e.message))}}><Users size={19}/><span><strong>{s.name}</strong><small>{s.owner?t('Criado por você'):t('Participante')}</small></span><ArrowLeft size={15}/></button>)}
   <div className="shared-columns"><form onSubmit={join} className="shared-box"><h3>{t('Entrar com código')}</h3><p className="muted">{t('Peça o código de convite ao criador do espaço.')}</p><label>{t('Código de convite')}<input required minLength={12} maxLength={12} value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/\s/g,''))} autoComplete="off" placeholder="XXXXXXXXXXXX"/></label><button className="primary" disabled={busy}>{t('Entrar no espaço')}</button></form>
   <form onSubmit={create} className="shared-box"><h3>{t('Criar espaço compartilhado')}</h3><p className="muted">{t('Criar um espaço é exclusivo do plano Pro. Qualquer conta pode participar por convite.')}</p>{canCreate?<><label>{t('Nome do espaço')}<input required minLength={3} maxLength={64} value={name} onChange={e=>setName(e.target.value)} placeholder={t('Ex.: Minha equipe')}/></label><button className="primary" disabled={busy}><Plus size={16}/>{t('Criar espaço')}</button></>:<p className="muted">{t('A criação está disponível para assinantes Pro. Você ainda pode entrar em espaços compartilhados.')}</p>}</form></div>
  </div>}
 </div>;
}
