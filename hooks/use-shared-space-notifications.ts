'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Item} from '../lib/ritmo-domain';

export type SharedSpaceNotification={
 id:string;spaceId:string;spaceName:string;actorName:string;
 itemCount:number;itemTitle:string;createdAt:number;
};
export type SharedSpacePopup={
 spaceId:string;spaceName:string;actorName:string;
 itemTitle:string;itemCount:number;local:boolean;
};
export type SharedSpaceScheduled={spaceId:string;spaceName:string;item:Item};
type Inbox={notifications:SharedSpaceNotification[];unreadBySpace:Record<string,number>;unreadTotal:number;schedule:SharedSpaceScheduled[]};

export function useSharedSpaceNotifications(enabled:boolean){
 const [notifications,setNotifications]=useState<SharedSpaceNotification[]>([]);
 const [schedule,setSchedule]=useState<SharedSpaceScheduled[]>([]);
 const [unreadBySpace,setUnreadBySpace]=useState<Record<string,number>>({});
 const [popup,setPopup]=useState<SharedSpacePopup|null>(null);
 const knownIds=useRef<Set<string>|null>(null);
 const busy=useRef(false);
 const enabledRef=useRef(enabled);
 enabledRef.current=enabled;

 const refresh=useCallback(async()=>{
  if(!enabledRef.current||busy.current||document.visibilityState==='hidden')return;
  busy.current=true;
  try{
   const response=await fetch('/api/spaces/notifications',{cache:'no-store'});
   if(!response.ok)return;
   const data=await response.json() as Inbox;
   if(!enabledRef.current)return;
   const previous=knownIds.current;
   if(previous){
    const fresh=data.notifications.filter(item=>!previous.has(item.id));
    if(fresh.length){
     const first=fresh[0];
     setPopup({spaceId:first.spaceId,spaceName:first.spaceName,actorName:first.actorName,itemTitle:first.itemTitle,itemCount:first.itemCount,local:false});
    }
    for(const item of data.notifications)previous.add(item.id);
   }else knownIds.current=new Set(data.notifications.map(item=>item.id));
   setNotifications(data.notifications);
   setUnreadBySpace(data.unreadBySpace);
   setSchedule(Array.isArray(data.schedule)?data.schedule:[]);
  }catch{
   // Temporary offline errors must never wipe persistent unread indicators.
  }finally{busy.current=false;}
 },[]);

 useEffect(()=>{
  if(!enabled){
   knownIds.current=null;setNotifications([]);setUnreadBySpace({});setPopup(null);setSchedule([]);
   return;
  }
  void refresh();
  const interval=setInterval(()=>void refresh(),15000);
  const onFocus=()=>void refresh();
  const onVisibility=()=>{if(document.visibilityState==='visible')void refresh();};
  window.addEventListener('focus',onFocus);
  document.addEventListener('visibilitychange',onVisibility);
  return()=>{clearInterval(interval);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisibility);};
 },[enabled,refresh]);

 const readSpace=useCallback(async(spaceId:string)=>{
  try{
   const response=await fetch('/api/spaces/notifications',{
    method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'read',spaceId})
   });
   if(!response.ok)return;
   setNotifications(old=>old.filter(item=>item.spaceId!==spaceId));
   setUnreadBySpace(old=>{const copy={...old};delete copy[spaceId];return copy;});
   setPopup(old=>old?.spaceId===spaceId?null:old);
   void refresh();
  }catch{ /* An unread item remains marked until the server confirms it was seen. */ }
 },[refresh]);

 const localAdded=useCallback((info:{spaceId:string;spaceName:string;count:number;firstTitle:string})=>{
  if(!info.count)return;
  setPopup({spaceId:info.spaceId,spaceName:info.spaceName,actorName:'',itemTitle:info.firstTitle,itemCount:info.count,local:true});
  void refresh();
 },[refresh]);

 const unreadTotal=Object.values(unreadBySpace).reduce((sum,n)=>sum+n,0);
 return {notifications,unreadBySpace,unreadTotal,schedule,popup,dismissPopup:()=>setPopup(null),readSpace,localAdded,refresh};
}
