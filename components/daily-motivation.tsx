'use client';
import {useEffect,useState} from 'react';
import {useLocale} from './language-selector';
import {dailyMotivation} from '../lib/daily-motivation';

const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
export default function DailyMotivation(){
  const {locale}=useLocale();
  const [today,setToday]=useState(localDate);
  useEffect(()=>{
    const interval=setInterval(()=>setToday(localDate()),60_000);
    return ()=>clearInterval(interval);
  },[]);
  return <p className="daily-motivation" aria-live="off">{dailyMotivation(today,locale)}</p>;
}
