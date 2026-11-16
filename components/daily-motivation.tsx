'use client';
import {useEffect,useState} from 'react';
import {useLocale} from './language-selector';
import {dailyMotivation,capitalizeMotivation} from '../lib/daily-motivation';

const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
export default function DailyMotivation(){
  const {locale}=useLocale();
  const [today,setToday]=useState(localDate);
  useEffect(()=>{
    const interval=setInterval(()=>setToday(localDate()),60_000);
    return ()=>clearInterval(interval);
  },[]);
  const date=new Date(today+'T12:00:00Z');
  const fullDate=new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date);
  const shortDate=new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',timeZone:'UTC'}).format(date);
  const prefix=(locale==='en'?'For ':locale==='es'?'Para el ':'Para ')+fullDate+', ';
  const message=dailyMotivation(today,locale);
  const quote=capitalizeMotivation(message.startsWith(prefix)?message.slice(prefix.length):message,locale);
  return <div className="daily-motivation" aria-live="off">
    <p>{quote}</p><small>{shortDate}</small>
  </div>;
}
