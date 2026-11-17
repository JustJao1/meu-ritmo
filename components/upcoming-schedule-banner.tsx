'use client';
import {useEffect,useMemo,useState} from 'react';
import {CalendarDays,Clock3,ChevronRight} from 'lucide-react';
import {upcomingAlerts} from '../lib/alerts';
import type {Item} from '../lib/ritmo-domain';
import type {SharedSpaceScheduled} from '../hooks/use-shared-space-notifications';
import {useLocale} from './language-selector';

export default function UpcomingScheduleBanner({items,shared,timezone,onOpenPersonal,onOpenShared}:{
 items:Item[];shared:SharedSpaceScheduled[];timezone:string;
 onOpenPersonal:(item:Item)=>void;onOpenShared:(id:string)=>void;
}){
 const {t,locale}=useLocale();
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{
  const refresh=()=>setNow(new Date());
  const timer=setInterval(refresh,15000);
  document.addEventListener('visibilitychange',refresh);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 const upcoming=useMemo(()=>upcomingAlerts([
  ...items.map(item=>({item})),
  ...shared.map(s=>({item:s.item,spaceId:s.spaceId,spaceName:s.spaceName}))
 ],now,timezone),[items,shared,now,timezone]);
 if(!upcoming.length)return null;
 return <section className="mr-upcoming" aria-label={t('Próximos horários')}>
  <div className="mr-upcoming-heading"><Clock3 size={17}/><strong>{t('Próximos horários')}</strong></div>
  <div className="mr-upcoming-items">
   {upcoming.slice(0,3).map(entry=><button type="button" key={entry.key} onClick={()=>entry.spaceId?onOpenShared(entry.spaceId):onOpenPersonal(entry.item)}>
    <CalendarDays size={16}/>
    <span><strong>{entry.item.title}</strong><small>{entry.spaceName?entry.spaceName+' · ':''}{new Date(entry.date+'T12:00:00').toLocaleDateString(locale,{day:'2-digit',month:'short'})} · {entry.time}</small></span>
    <ChevronRight size={14}/>
   </button>)}
   {upcoming.length>3&&<small className="mr-upcoming-more">+{upcoming.length-3} {t('outros horários')}</small>}
  </div>
 </section>;
}
