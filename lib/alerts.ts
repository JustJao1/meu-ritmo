import {occurs,isDone,type Item} from './ritmo-domain';
export function alertMoment(now:Date,timezone:string){return {date:new Intl.DateTimeFormat('en-CA',{timeZone:timezone}).format(now),time:new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now)}}
export function dueAlerts(items:Item[],now:Date,timezone:string){const {date,time}=alertMoment(now,timezone);return items.filter(i=>i.enabled!==false&&(i.notify||i.type==='alarm'||i.type==='event'||i.type==='reminder'||i.soundAlarm)&&i.time===time&&occurs(i,date)&&!isDone(i,date)).map(item=>({item,key:item.id+':'+date+':'+time}));}
export function snoozedAlert(item:Item,now:Date,timezone:string):Item{const {date,time}=alertMoment(new Date(now.getTime()+10*60000),timezone);return {...item,id:crypto.randomUUID(),type:item.type==='event'||item.type==='task'?'alarm':item.type,date,time,end:'',notify:true,soundAlarm:true,repeat:'none',days:[],completedDates:[],skipDates:[],done:false,enabled:true,archived:false};}

export type ScheduledSource={item:Item;spaceId?:string;spaceName?:string};
export type UpcomingOccurrence={item:Item;spaceId?:string;spaceName?:string;date:string;time:string;key:string};
/** Upcoming items remain visible until their start minute, including recurring occurrences. */
export function upcomingAlerts(sources:ScheduledSource[],now:Date,timezone:string,daysAhead=14):UpcomingOccurrence[]{
 const current=alertMoment(now,timezone);
 const start=Date.parse(current.date+'T00:00:00Z');
 return sources.flatMap(source=>{
  const item=source.item;
  if(item.archived||item.enabled===false||!item.time||!['event','reminder','task','alarm'].includes(item.type))return [];
  for(let offset=0;offset<=daysAhead;offset++){
   const date=new Date(start+offset*86400000).toISOString().slice(0,10);
   if(!occurs(item,date)||isDone(item,date))continue;
   if(date===current.date&&item.time<=current.time)continue;
   return [{...source,date,time:item.time,key:(source.spaceId||'personal')+':'+item.id+':'+date+':'+item.time}];
  }
  return [];
 }).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,20);
}
