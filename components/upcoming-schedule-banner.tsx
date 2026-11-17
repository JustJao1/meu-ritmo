'use client';
import {CalendarDays,Clock3,ChevronRight} from 'lucide-react';
import type {UpcomingOccurrence} from '../lib/alerts';
import {useLocale} from './language-selector';

export default function UpcomingScheduleBanner({upcoming,onOpenShared}:{
 upcoming:UpcomingOccurrence[];
 onOpenShared:(id:string)=>void;
}){
 const {t,locale}=useLocale();
 if(!upcoming.length)return null;
 return <section className="mr-upcoming" aria-label={t('Próximos horários')}>
  <div className="mr-upcoming-heading"><Clock3 size={17}/><strong>{t('Próximos horários')}</strong></div>
  <div className="mr-upcoming-items">
   {upcoming.slice(0,3).map(entry=><button type="button" key={entry.key} onClick={()=>entry.spaceId&&onOpenShared(entry.spaceId)}>
    <CalendarDays size={16}/>
    <span><strong>{entry.item.title}</strong><small>{entry.spaceName?entry.spaceName+' · ':''}{new Date(entry.date+'T12:00:00').toLocaleDateString(locale,{day:'2-digit',month:'short'})} · {entry.time}</small></span>
    <ChevronRight size={14}/>
   </button>)}
   {upcoming.length>3&&<small className="mr-upcoming-more">+{upcoming.length-3} {t('outros horários')}</small>}
  </div>
 </section>;
}