'use client';
import {useEffect,useRef,useState} from 'react';
import {useLocale} from './language-selector';

type TurnstileAPI={
 render:(node:HTMLElement,options:{sitekey:string;theme:'auto';callback:(token:string)=>void;'expired-callback':()=>void;'error-callback':()=>void})=>string;
 remove:(id:string)=>void;
};
declare global{interface Window{turnstile?:TurnstileAPI}}
export default function TurnstileCaptcha({siteKey,onToken,resetKey}:{siteKey:string;onToken:(token:string)=>void;resetKey:number}){
 const {t}=useLocale();
 const target=useRef<HTMLDivElement>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let cancelled=false;
  let widgetId:string|undefined;
  onToken('');setFailed(false);
  function render(){
   if(cancelled||!target.current||!window.turnstile||widgetId)return;
   widgetId=window.turnstile.render(target.current,{
    sitekey:siteKey,theme:'auto',
    callback:token=>{if(!cancelled){setFailed(false);onToken(token);}},
    'expired-callback':()=>{if(!cancelled)onToken('');},
    'error-callback':()=>{if(!cancelled){onToken('');setFailed(true);}}
   });
  }
  const current=document.querySelector<HTMLScriptElement>('script[data-mr-turnstile]');
  let script=current;
  if(!window.turnstile){
   if(!script){
    script=document.createElement('script');
    script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async=true;
    script.dataset.mrTurnstile='true';
    document.head.appendChild(script);
   }
   script.addEventListener('load',render);
   script.addEventListener('error',()=>{if(!cancelled)setFailed(true);},{once:true});
  }
  render();
  return ()=>{cancelled=true;script?.removeEventListener('load',render);if(widgetId)window.turnstile?.remove(widgetId);};
 },[siteKey,resetKey,onToken]);
 return <div className="authcaptcha" role="group" aria-label={t('Verificação de segurança')}>
  <div ref={target}/>
  {failed&&<p className="autherror" role="alert">{t('Não foi possível carregar a verificação de segurança. Atualize a página.')}</p>}
 </div>;
}
