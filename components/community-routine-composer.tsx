'use client';
import {useState} from 'react';
import {ArrowDown,ArrowRight,ArrowUp,NotebookPen,Plus,Trash2,X} from 'lucide-react';
import {useLocale} from './language-selector';

type Task={title:string;time:string};
type DraftTask=Task&{id:string};
type SavedTemplate={id:string;name:string;items:Task[]};
const makeRow=(title='',time=''):DraftTask=>({id:crypto.randomUUID(),title,time});

export default function CommunityRoutineComposer({
 onClose,onPublish,templates,busy,error
}:{
 onClose:()=>void;
 onPublish:(payload:{action:'post';category:'rotinas';title:string;body:string;template:Task[];shareConfirmed:true})=>Promise<boolean>;
 templates:SavedTemplate[];
 busy:boolean;
 error:string;
}){
 const {t}=useLocale();
 const [title,setTitle]=useState('');
 const [body,setBody]=useState('');
 const [rows,setRows]=useState<DraftTask[]>([makeRow()]);
 const [confirmed,setConfirmed]=useState(false);
 const [selected,setSelected]=useState('');
 const complete=rows.map(x=>({title:x.title.trim(),time:x.time.trim()})).filter(x=>x.title.length>0);
 const valid=title.trim().length>=3&&body.trim().length>=3&&complete.length>0&&
  complete.length<=30&&rows.every(x=>x.title.trim().length>=1&&x.title.trim().length<=200)&&confirmed;
 const change=(id:string,part:Partial<Task>)=>setRows(old=>old.map(row=>row.id===id?{...row,...part}:row));
 const move=(index:number,delta:number)=>setRows(old=>{
  const pos=index+delta;if(pos<0||pos>=old.length)return old;
  const copy=[...old];[copy[index],copy[pos]]=[copy[pos],copy[index]];return copy;
 });
 function useSaved(value:string){
  setSelected(value);
  const template=templates.find(x=>x.id===value);
  if(!template)return;
  setTitle(template.name.slice(0,120));
  setRows(template.items.slice(0,30).map(x=>makeRow(x.title,x.time)));
  setConfirmed(false);
 }
 async function publish(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!valid||busy)return;
  if(await onPublish({
   action:'post',category:'rotinas',title:title.trim(),body:body.trim(),
   template:complete,shareConfirmed:true
  }))onClose();
 }
 return <div className="overlay">
   <section className="dialog community-routine-editor" role="dialog" aria-modal="true" aria-labelledby="routine-compose-title">
    <header><div className="routine-editor-heading"><span className="eyebrow">{t('EXCLUSIVO DO PRO')}</span>
      <h2 id="routine-compose-title">{t('Publicar rotina personalizada')}</h2></div>
      <button type="button" className="iconbtn" onClick={onClose} aria-label={t('Fechar publicação de rotina')}><X/></button>
    </header>
    <p className="routine-editor-intro">{t('Monte uma rotina com suas próprias tarefas e horários. Só o conteúdo que você confirmar será publicado no Social.')}</p>
    <form onSubmit={publish}>
      {templates.length>0&&<label className="routine-editor-saved">
       {t('Começar com um dos meus modelos (opcional)')}
       <select value={selected} onChange={e=>useSaved(e.target.value)}>
        <option value="">{t('Criar do zero')}</option>
        {templates.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
       </select>
      </label>}
      <div className="routine-editor-metadata">
       <label>{t('Nome da rotina')}
        <input autoFocus required minLength={3} maxLength={120} value={title}
          onChange={e=>setTitle(e.target.value)} placeholder={t('Ex.: Minha rotina de treino e estudos')}/>
       </label>
       <label>{t('Descrição da rotina')}
        <textarea required minLength={3} maxLength={4000} rows={3} value={body}
         onChange={e=>setBody(e.target.value)} placeholder={t('Explique para quem é a rotina, como funciona e quais ajustes você recomenda.')}/>
       </label>
      </div>
      <div className="routine-editor-task-header">
       <div><h3>{t('Tarefas e horários')}</h3>
        <p>{t('Organize as etapas na ordem em que devem aparecer. Horários são opcionais.')}</p></div>
       <span className="routine-editor-count">{rows.length}/30</span>
      </div>
      <div className="routine-editor-tasks">
       {rows.map((task,index)=><div className="routine-editor-task" key={task.id}>
        <span className="routine-editor-number">{index+1}</span>
        <label className="routine-editor-task-name">{t('Tarefa')}
          <input required maxLength={200} value={task.title} onChange={e=>change(task.id,{title:e.target.value})}
           placeholder={t('Ex.: Aquecimento e mobilidade')}/>
        </label>
        <label className="routine-editor-task-time">{t('Horário')}
          <input aria-label={t('Horário')+' '+(index+1)} type="time" value={task.time}
           onChange={e=>change(task.id,{time:e.target.value})}/>
        </label>
        <div className="routine-editor-controls">
         <button type="button" disabled={index===0} onClick={()=>move(index,-1)} title={t('Mover para cima')} aria-label={t('Mover tarefa para cima')}><ArrowUp size={15}/></button>
         <button type="button" disabled={index===rows.length-1} onClick={()=>move(index,1)} title={t('Mover para baixo')} aria-label={t('Mover tarefa para baixo')}><ArrowDown size={15}/></button>
         <button type="button" disabled={rows.length===1} onClick={()=>setRows(old=>old.filter(x=>x.id!==task.id))} title={t('Remover tarefa')} aria-label={t('Remover tarefa')}><Trash2 size={15}/></button>
        </div>
       </div>)}
      </div>
      {rows.length<30&&<button className="routine-editor-add" type="button" onClick={()=>setRows(old=>[...old,makeRow()])}>
       <Plus size={16}/>{t('Adicionar tarefa')}
      </button>}
      <div className="routine-editor-preview"><NotebookPen size={18}/>
       <span>{complete.length} {t('tarefas para compartilhar')}. {t('Outras pessoas poderão visualizar e copiar o modelo para suas próprias rotinas.')}</span>
      </div>
      <label className="checkline routine-editor-confirm"><input required type="checkbox" checked={confirmed}
       onChange={e=>setConfirmed(e.target.checked)}/>
       {t('Confirmo que estas tarefas podem ser públicas e não contêm informações privadas minhas ou de outras pessoas.')}
      </label>
      {error&&<p className="adminerror" role="alert">{error}</p>}
      <div className="dialogactions">
       <button type="button" onClick={onClose}>{t('Cancelar')}</button>
       <button type="submit" className="primary" disabled={!valid||busy}>{busy?t('Publicando…'):t('Publicar rotina')}<ArrowRight size={16}/></button>
      </div>
    </form>
   </section>
  </div>;
}
