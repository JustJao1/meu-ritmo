'use client';
import {CalendarClock,CalendarDays,ChevronRight} from 'lucide-react';
import type {UpcomingOccurrence} from '../lib/alerts';
import type {Item} from '../lib/ritmo-domain';
import {useLocale} from './language-selector';

export default function UpcomingEventsInbox({upcoming,onOpenPersonal,onOpenShared}:{
 upcoming:UpcomingOccurrence[];
 onOpenPersonal:(item:Item)=>void;
 onOpenShared:(spaceId:string)=>void;
}){
 const {t,locale}=useLocale();
 return <section className="mr-upcoming-inbox" aria-label={t('Eventos agendados')}>
  <header className="mr-upcoming-inbox-header">
   <span><CalendarClock size={18}/><strong>{t('Eventos agendados')}</strong></span>
   {upcoming.length>0&&<span className="mr-upcoming-inbox-count">{upcoming.length>99?'99+':upcoming.length}</span>}
  </header>
  {upcoming.length? <div className="mr-upcoming-inbox-list">
   {upcoming.map(entry=><button type="button" key={entry.key} onClick={()=>entry.spaceId?onOpenShared(entry.spaceId):onOpenPersonal(entry.item)}>
    <span className="mr-upcoming-inbox-icon"><CalendarDays size={18}/></span>
    <span className="mr-upcoming-inbox-description">
     <strong>{entry.item.title}</strong>
     <small>{entry.spaceName||t('Meu espaço pessoal')} · {new Date(entry.date+'T12:00:00').toLocaleDateString(locale,{day:'2-digit',month:'long'})} · {entry.time}</small>
    </span><ChevronRight size={16}/>
   </button>)}
  </div>:<p className="muted">{t('Nenhum evento futuro agendado.')}</p>}
 </section>;
}
