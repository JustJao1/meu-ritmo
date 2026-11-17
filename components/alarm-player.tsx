'use client';
import {useEffect,useRef,useState} from 'react';
import {AlarmClock,Volume2,Clock3,PauseCircle,X,Check} from 'lucide-react';
import {dueAlerts,snoozedAlert} from '../lib/alerts';
import type {Item} from '../lib/ritmo-domain';
import type {SharedSpaceScheduled} from '../hooks/use-shared-space-notifications';

type AlertEntry={item:Item;spaceName?:string;shared:boolean};
type Props={
 items:Item[];shared?:SharedSpaceScheduled[];timezone:string;
 onNotice:(s:string)=>Promise<void>;onToast:(s:string)=>void;
 onSnooze:(i:Item)=>void;demo:boolean;
};
export default function AlarmPlayer({items,shared=[],timezone,onNotice,onToast,onSnooze,demo}:Props){
 const [queue,setQueue]=useState<AlertEntry[]>([]);
 const [ready,setReady]=useState(false);
 const [acknowledged,setAcknowledged]=useState(false);
 const [err,setErr]=useState('');
 const audio=useRef<AudioContext|null>(null);
 const fired=useRef(new Set<string>());
 const latest=useRef(items);
 const sharedLatest=useRef(shared);
 latest.current=items;
 sharedLatest.current=shared;
 const activeEntry=queue[0],active=activeEntry?.item;
 const soundWanted=items.some(i=>i.enabled!==false&&!i.archived&&(i.type==='alarm'||i.type==='event'||i.type==='reminder'||i.soundAlarm))
  ||shared.some(s=>s.item.enabled!==false&&!s.item.archived&&['event','reminder','task'].includes(s.item.type)&&!!s.item.time);

 function beep(){
  const context=audio.current;
  if(context?.state!=='running')return;
  const start=context.currentTime;
  for(let n=0;n<2;n++){
   const at=start+n*.24,osc=context.createOscillator(),gain=context.createGain();
   osc.type='sine';
   osc.frequency.setValueAtTime(n===0?784:988,at);
   gain.gain.setValueAtTime(0.0001,at);
   gain.gain.exponentialRampToValueAtTime(.13,at+.028);
   gain.gain.exponentialRampToValueAtTime(.001,at+.3);
   osc.connect(gain);gain.connect(context.destination);osc.start(at);osc.stop(at+.31);
  }
 }
 async function enable(test=true){
  try{
   audio.current??=new AudioContext();
   await audio.current.resume();
   const active=audio.current.state==='running';
   setReady(active);
   if(active){
    setAcknowledged(true);
    try{localStorage.setItem('mr_alarm_audio_ack_v1','1');}catch{}
    setErr('');
    if(test)beep();
   }
  }catch{setErr('Não foi possível ativar o som. Confira as permissões desta aba.');}
 }
 useEffect(()=>{
  try{setAcknowledged(localStorage.getItem('mr_alarm_audio_ack_v1')==='1');}
  catch{setAcknowledged(false);}
 },[]);
 // Browsers require a new user gesture to unlock Web Audio after a page reload.
 useEffect(()=>{
  if(!acknowledged||ready)return;
  const unlock=()=>{void enable(false);};
  window.addEventListener('pointerdown',unlock,{once:true});
  window.addEventListener('keydown',unlock,{once:true});
  return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);};
 },[acknowledged,ready]);

 useEffect(()=>{
  const storageKey=demo?'mr_demo_fired_v2':'mr_fired_v2';
  try{
   const stored=JSON.parse(localStorage.getItem(storageKey)||'[]');
   if(Array.isArray(stored))fired.current=new Set(stored.filter(v=>typeof v==='string').slice(-600));
  }catch{}
  const tick=()=>{
   // Shared space IDs prevent collisions with personal items and other spaces.
   const incoming:AlertEntry[]=[];
   for(const {item,key} of dueAlerts(latest.current,new Date(),timezone)){
    const unique='personal:'+key;
    if(fired.current.has(unique))continue;
    fired.current.add(unique);
    incoming.push({item,shared:false});
   }
   for(const entry of sharedLatest.current){
    const due=dueAlerts([{...entry.item,notify:true}],new Date(),timezone);
    for(const {item,key} of due){
     const unique='shared:'+entry.spaceId+':'+key;
     if(fired.current.has(unique))continue;
     fired.current.add(unique);
     incoming.push({item,shared:true,spaceName:entry.spaceName});
    }
   }
   if(!incoming.length)return;
   try{localStorage.setItem(storageKey,JSON.stringify([...fired.current].slice(-600)));}catch{}
   for(const entry of incoming){
    const title=(entry.spaceName?entry.spaceName+' · ':'')+entry.item.title;
    onToast('Está na hora: '+title);
    if(typeof Notification!=='undefined'&&Notification.permission==='granted')
     void onNotice(title).catch(()=>{});
   }
   setQueue(old=>[...old,...incoming]);
  };
  tick();
  const timer=setInterval(tick,1000);
  const onVisible=()=>{if(document.visibilityState==='visible')tick();};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
 },[timezone,demo,onNotice,onToast]);

 useEffect(()=>{
  if(!active||!ready)return;
  beep();
  const interval=setInterval(beep,1700);
  // Stop the repeating sound after 45s; keep the alert visible until dismissal.
  const limit=setTimeout(()=>clearInterval(interval),45000);
  return()=>{clearInterval(interval);clearTimeout(limit);};
 },[active?.id,ready]);

 useEffect(()=>()=>{void audio.current?.close();},[]);
 const dismiss=()=>setQueue(q=>q.slice(1));
 return <>
  {soundWanted&&!ready&&!active&&<div className="soundnotice" role="status">
   <div className="soundnotice-icon"><Volume2 size={19}/></div>
   <div className="soundnotice-copy"><strong>Ative o som dos avisos</strong><span>Um toque para ouvir compromissos e lembretes enquanto o site estiver aberto.</span>{err&&<span className="alarmerror" role="alert">{err}</span>}</div>
   <button className="soundnotice-action" onClick={()=>void enable()}>Ativar e testar <Volume2 size={15}/></button>
  </div>}
  {active&&<div className="alarmbackdrop"><section className="alarmnotice" role="alertdialog" aria-modal="true" aria-labelledby="ringtitle" aria-describedby="ringhelp">
   <div className="alarmnotice-top"><div className="alarmnotice-state"><span className="alarmnotice-pulse"><AlarmClock size={18}/></span><span>{ready?'HORÁRIO CHEGOU':'AVISO DO HORÁRIO'}</span></div><button type="button" className="alarmnotice-close" onClick={dismiss} aria-label="Parar e fechar aviso"><X size={19}/></button></div>
   <div className="alarmnotice-time"><Clock3 size={20}/><time>{active.time||new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></div>
   {activeEntry.spaceName&&<p className="alarmnotice-space">{activeEntry.spaceName}</p>}
   <h2 id="ringtitle">{active.title}</h2>
   {active.body&&<p className="alarmnotice-body">{active.body}</p>}
   <p id="ringhelp" className="alarmnotice-help">{ready?'Está na hora do compromisso. O aviso ficará aqui até você fechar.':'O horário chegou. Ative o som para ouvir os próximos avisos.'}</p>
   {queue.length>1&&<p className="alarmnotice-queue">{queue.length-1} {queue.length===2?'outro aviso aguardando':'outros avisos aguardando'}</p>}
   {!ready&&<button className="alarmnotice-enable" onClick={()=>void enable()}><Volume2 size={17}/> Ativar som agora</button>}
   <div className="alarmnotice-actions">
    {!activeEntry.shared&&<button type="button" className="alarmnotice-snooze" onClick={()=>{onSnooze(snoozedAlert(active,new Date(),timezone));dismiss();onToast('Novo aviso em dez minutos. Mantenha esta aba aberta.');}}><PauseCircle size={19}/> Adiar 10 minutos</button>}
    <button type="button" autoFocus className="alarmnotice-stop" onClick={dismiss}><Check size={19}/> Entendi, fechar aviso</button>
   </div>
   {err&&<p className="alarmerror" role="alert">{err}</p>}
   <p className="alarmnotice-footnote">Avisos sonoros do site funcionam com a página aberta e áudio ativado.</p>
  </section></div>}
 </>;
}
