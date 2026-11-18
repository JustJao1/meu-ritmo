'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
import {useLocale} from './language-selector';
import type {SupportTicket} from '../lib/support';
export default function AdminSupport(){
 const {t,locale}=useLocale();
 const [tickets,setTickets]=useState<SupportTicket[]>([]),[selected,setSelected]=useState(''),[status,setStatus]=useState(''),[page,setPage]=useState(0),[hasMore,setHasMore]=useState(false),[stats,setStats]=useState({total:0,pending:0}),[answer,setAnswer]=useState(''),[nextStatus,setNextStatus]=useState('in_progress'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const id=useRef('');
 const load=useCallback(async()=>{try{const q=new URLSearchParams({page:String(page)});if(status)q.set('status',status);const r=await fetch('/api/admin/support?'+q,{cache:'no-store'}),v:any=await r.json();if(!r.ok)throw Error(v.error);setTickets(v.tickets||[]);setStats({total:Number(v.stats?.total)||0,pending:Number(v.stats?.pending)||0});setHasMore(!!v.hasMore);}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar a fila de atendimento.');}},[page,status]);
 useEffect(()=>{void load();},[load]);
 const current=tickets.find(x=>x.id===selected);
 async function save(){if(!current||busy)return;setBusy(true);setError('');if(!id.current)id.current=crypto.randomUUID();try{const r=await fetch('/api/admin/support',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:current.id,messageId:id.current,status:nextStatus,body:answer})}),v:any=await r.json();if(!r.ok)throw Error(v.error);setNotice(v.message);setAnswer('');id.current='';await load();}catch(e){setError(e instanceof Error?e.message:'Não foi possível responder.');}finally{setBusy(false)}}
 return <section className="admin-support"><div className="adminsectionintro"><h2>{t('Atendimento ao cliente')}</h2><p>{t('Responda solicitações com protocolo. As conversas ficam registradas na conta do usuário.')}</p></div>
 <div className="support-metrics"><span>{t('Total de atendimentos')}: <strong>{stats.total}</strong></span><span>{t('Pendentes')}: <strong>{stats.pending}</strong></span></div>
 <label>{t('Filtrar por status')} <select value={status} onChange={e=>{setStatus(e.target.value);setPage(0);setSelected('')}}><option value="">{t('Todos')}</option>{[['open','Recebido'],['in_progress','Em atendimento'],['waiting_user','Aguardando usuário'],['closed','Concluído']].map(([key,label])=><option value={key} key={key}>{t(label)}</option>)}</select></label>
 {error&&<p role="alert" className="autherror">{t(error)}</p>}{notice&&<p role="status">{t(notice)}</p>}
 {current?<><button className="subtlelink" onClick={()=>setSelected('')}>{t('Voltar à fila')}</button><article className="support-thread"><h3>{current.subject}</h3><small>{current.email||current.user_id} · {t('Protocolo')}: {current.id}</small>{current.messages.map(m=><div className="support-message" key={m.id}><strong>{t(m.author_role==='admin'?'Equipe Meu Ritmo':'Cliente')}</strong><p>{m.body}</p><small>{new Date(m.created_at*1000).toLocaleString(locale)}</small></div>)}</article>
 <label>{t('Status')}<select value={nextStatus} onChange={e=>setNextStatus(e.target.value)}>{[['open','Recebido'],['in_progress','Em atendimento'],['waiting_user','Aguardando usuário'],['closed','Concluído']].map(([key,label])=><option key={key} value={key}>{t(label)}</option>)}</select></label>
 <label>{t('Responder ao cliente')}<textarea rows={4} value={answer} maxLength={3000} onChange={e=>setAnswer(e.target.value)}/></label><button className="primary" disabled={busy} onClick={()=>void save()}>{t('Salvar atendimento')}</button>
 </>:<div className="support-ticket-list">{tickets.map(ti=><button key={ti.id} onClick={()=>{setSelected(ti.id);setNextStatus(ti.status);setAnswer('')}}><strong>{ti.subject}</strong><span>{ti.email||ti.user_id} · {t(ti.status)}</span><small>{ti.id}</small></button>)}{!tickets.length&&<p>{t('Nenhum atendimento neste filtro.')}</p>}</div>}
 <div className="support-pagination"><button disabled={page===0} onClick={()=>setPage(Math.max(0,page-1))}>{t('Anterior')}</button><span>{t('Página')} {page+1}</span><button disabled={!hasMore} onClick={()=>setPage(page+1)}>{t('Próxima')}</button></div>
 </section>;
}
