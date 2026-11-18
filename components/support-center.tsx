'use client';
import {useEffect,useState,useRef} from 'react';
import {useLocale} from './language-selector';
import type {SupportTicket} from '../lib/support';
export default function SupportCenter({demo=false}:{demo?:boolean}){
 const {t,locale}=useLocale();
 const [tickets,setTickets]=useState<SupportTicket[]>([]),[active,setActive]=useState(''),[category,setCategory]=useState('technical'),[subject,setSubject]=useState(''),[message,setMessage]=useState(''),[answer,setAnswer]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const requestId=useRef(''),messageId=useRef('');
 const load=async()=>{if(demo)return;try{const r=await fetch('/api/support',{cache:'no-store'});const d:any=await r.json();if(!r.ok)throw Error(d.error);setTickets(d.tickets||[]);}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar os atendimentos.');}};
 useEffect(()=>{void load();},[demo]);
 const when=(unix:number)=>new Date(unix*1000).toLocaleString(locale,{dateStyle:'short',timeStyle:'short'});
 const current=tickets.find(x=>x.id===active);
 async function post(payload:Record<string,unknown>){if(busy)return false;setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/support',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d:any=await r.json();if(!r.ok)throw Error(d.error);setNotice(d.message||'Atualizado.');await load();return true;}catch(e){setError(e instanceof Error?e.message:'Não foi possível enviar.');return false;}finally{setBusy(false);}}
 if(demo)return <section className="support-center"><p>{t('Entre na sua conta para solicitar atendimento.')}</p><a href="/entrar" className="primary">{t('Entrar')}</a></section>;
 return <section className="support-center"><p>{t('Fale com a equipe sobre sua conta, pagamento ou dificuldades no aplicativo. Cada pedido tem um protocolo e pode ser acompanhado aqui.')}</p>
 {error&&<p className="autherror" role="alert">{t(error)}</p>}{notice&&<p role="status">{t(notice)}</p>}
 {current?<><button className="subtlelink" onClick={()=>setActive('')}>{t('Voltar aos atendimentos')}</button>
 <article className="support-thread"><h3>{current.subject}</h3><small>{t('Protocolo')}: {current.id}</small><p>{t('Status')}: <strong>{t(current.status==='open'?'Recebido':current.status==='in_progress'?'Em atendimento':current.status==='waiting_user'?'Aguardando sua resposta':'Concluído')}</strong></p>
 {current.messages.map(m=><div className="support-message" key={m.id}><strong>{t(m.author_role==='admin'?'Equipe Meu Ritmo':'Você')}</strong><p>{m.body}</p><small>{when(m.created_at)}</small></div>)}</article>
 <form onSubmit={async e=>{e.preventDefault();if(!messageId.current)messageId.current=crypto.randomUUID();if(await post({action:'reply',id:current.id,messageId:messageId.current,body:answer})){setAnswer('');messageId.current='';}}}><label>{t('Responder ao atendimento')}<textarea required rows={3} minLength={2} maxLength={3000} value={answer} onChange={e=>setAnswer(e.target.value)}/></label><button className="primary" disabled={busy||answer.trim().length<2}>{t('Enviar mensagem')}</button></form>
 </>:<><div className="support-ticket-list">{tickets.map(x=><button key={x.id} onClick={async()=>{setActive(x.id);if(x.unread_user)await post({action:'seen',id:x.id});}}><strong>{x.subject}</strong><span>{t(x.status==='open'?'Recebido':x.status==='in_progress'?'Em atendimento':x.status==='waiting_user'?'Aguardando sua resposta':'Concluído')} {x.unread_user?' · '+t('Nova resposta'):''}</span><small>{t('Protocolo')}: {x.id} · {when(x.updated_at)}</small></button>)}</div>
 <form className="support-create" onSubmit={async e=>{e.preventDefault();if(!requestId.current)requestId.current=crypto.randomUUID();if(await post({action:'create',id:requestId.current,category,subject,body:message})){setSubject('');setMessage('');requestId.current='';}}}>
 <h3>{t('Novo atendimento')}</h3><label>{t('Assunto do pedido')}<select value={category} onChange={e=>setCategory(e.target.value)}><option value="account">{t('Conta e acesso')}</option><option value="billing">{t('Pagamento e assinatura')}</option><option value="technical">{t('Problema técnico')}</option><option value="other">{t('Outro assunto')}</option></select></label>
 <label>{t('Título do atendimento')}<input value={subject} onChange={e=>setSubject(e.target.value)} required minLength={5} maxLength={120}/></label>
 <label>{t('Como podemos ajudar?')}<textarea value={message} onChange={e=>setMessage(e.target.value)} required minLength={10} maxLength={3000} rows={4}/></label><p className="muted">{t('Não envie senhas, códigos de acesso nem dados de cartão.')}</p>
 <button className="primary" disabled={busy||subject.trim().length<5||message.trim().length<10}>{t('Abrir atendimento')}</button>
 </form></>}
 </section>;
}
