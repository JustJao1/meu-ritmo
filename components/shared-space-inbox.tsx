'use client';
import {BellDot,ChevronRight,Users} from 'lucide-react';
import {useLocale} from './language-selector';
import type {SharedSpaceNotification} from '../hooks/use-shared-space-notifications';

export default function SharedSpaceInbox({notifications,total,onOpenSpace,onOpenList}:{notifications:SharedSpaceNotification[];total:number;onOpenSpace:(spaceId:string)=>void;onOpenList:()=>void}){
 const {t}=useLocale();
 return <section className="shared-notification-inbox" aria-label={t('Novidades dos espaços')}>
  <div className="shared-inbox-heading"><span><BellDot size={18}/><strong>{t('Novidades dos espaços')}</strong></span>{total>0&&<span className="shared-inbox-counter">{total>99?'99+':total}</span>}</div>
  {notifications.length>0?<div className="shared-inbox-list">
   {notifications.slice(0,12).map(item=><button className="shared-inbox-item" type="button" key={item.id} onClick={()=>onOpenSpace(item.spaceId)}>
    <span className="shared-inbox-item-icon"><Users size={18}/></span>
    <span className="shared-inbox-item-body"><strong>{item.spaceName}</strong><small>{item.actorName} · {item.itemCount===1?t('Novo item adicionado'):t('Novos itens adicionados')} ({item.itemCount})</small><span>{item.itemTitle}{item.itemCount>1?'…':''}</span></span>
    <ChevronRight size={17}/>
   </button>)}
  </div>:<p className="muted shared-inbox-empty">{t('Nenhuma novidade pendente nos espaços.')}</p>}
  <button type="button" className="shared-inbox-view-all" onClick={onOpenList}>{t('Ver meus espaços')} <ChevronRight size={16}/></button>
 </section>;
}
