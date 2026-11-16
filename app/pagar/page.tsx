'use client';
import ContextIllustration from '../../components/context-illustration';
import {useCallback,useEffect,useState} from 'react';
import LanguageSelector,{useLocale} from '../../components/language-selector';
import './pix.css';

type PixReply={
 state?:'pending'|'paid'|'waiting'|'cancelled'|'unavailable';
 error?:string;message?:string;qrCode?:string;copyPaste?:string;
 amountCents?:number;dueDate?:string;expiresAt?:string|null;
};
export default function PixPaymentPage(){
 const {t,locale}=useLocale();
 const [orderId,setOrderId]=useState('');
 const [data,setData]=useState<PixReply|null>(null);
 const [loading,setLoading]=useState(true);
 const [copied,setCopied]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{const p=new URLSearchParams(window.location.search),v=p.get('pedido')||'';setOrderId(v);if(!v){setError('Identificador de pedido ausente.');setLoading(false);}},[]);
 const refresh=useCallback(async(id:string)=>{
   if(!id)return;
   try{
     const r=await fetch('/api/billing/pix',{method:'POST',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({orderId:id}),credentials:'same-origin',cache:'no-store'});
     const result:PixReply=await r.json();
     if(!r.ok){setError(result.error||result.message||'Não foi possível consultar o Pix.');setData(null);}
     else{setData(result);setError('');}
   }catch{setError('Falha de conexão ao consultar o Pix.');setData(null);}
   finally{setLoading(false);}
 },[]);
 useEffect(()=>{if(!orderId)return;void refresh(orderId);
   const interval=setInterval(()=>{if(document.visibilityState==='visible')void refresh(orderId);},20000);
   return()=>clearInterval(interval);
 },[orderId,refresh]);
 const copy=async()=>{if(!data?.copyPaste)return;try{await navigator.clipboard.writeText(data.copyPaste);setCopied(true);}
   catch{setCopied(false);}};
 const amount=typeof data?.amountCents==='number'
   ?(data.amountCents/100).toLocaleString(locale,{style:'currency',currency:'BRL'}):null;
 return <main className="mr-pix-page">
   <div className="mr-pix-top">
     <a className="mr-pix-brand" href="/app"><img src="/favicon-mr-v3.svg" alt="" width={38} height={38}/>MR: Meu Ritmo</a>
     <LanguageSelector/>
   </div>
   <section className="mr-pix-card" aria-live="polite">
     <ContextIllustration context="Pix"/><div className="mr-pix-tag">{t('Pagamento com Pix')}</div>
     <h1>{t('Concluir assinatura')}</h1>
     <p className="mr-pix-intro">{t('O pagamento é feito exclusivamente por Pix. A assinatura será ativada após a confirmação do Asaas.')}</p>
     {loading&&!data&&!error?<p role="status">{t('Consultando sua cobrança Pix…')}</p>:null}
     {error?<div className="mr-pix-message" role="alert"><p>{t(error)}</p><button type="button" onClick={()=>{setLoading(true);void refresh(orderId);}}>{t('Tentar novamente')}</button></div>:null}
     {data?.state==='pending'&&data.copyPaste&&data.qrCode?<div className="mr-pix-payment">
       <div className="mr-pix-amount"><span>{t('Valor a pagar')}</span><strong>{amount}</strong></div>
       <div className="mr-pix-image"><img src={data.qrCode} width={240} height={240} alt={t('QR Code Pix da sua cobrança')}/></div>
       <p>{t('Abra o aplicativo do seu banco e escaneie o código, ou copie o Pix Copia e Cola.')}</p>
       <label htmlFor="mr-pix-copy">{t('Pix Copia e Cola')}</label>
       <textarea id="mr-pix-copy" readOnly rows={3} value={data.copyPaste} onFocus={e=>e.currentTarget.select()}/>
       <button type="button" className="mr-pix-primary" onClick={copy}>{t(copied?'Código copiado':'Copiar código Pix')}</button>
       <p className="mr-pix-foot">{t('Depois de pagar, a confirmação pode levar alguns instantes. Esta página verifica o pagamento automaticamente.')}</p>
       {data.expiresAt?<small>{t('Validade do código:')} {new Date(data.expiresAt).toLocaleString(locale)}</small>:null}
     </div>:null}
     {data?.state==='paid'?<div className="mr-pix-success" role="status"><h2>{t('Pagamento confirmado')}</h2><p>{t('A confirmação foi recebida. Seu plano será atualizado pelo sistema.')}</p><a href="/app">{t('Ir para o Meu Ritmo')}</a></div>:null}
     {(data?.state==='waiting'||data?.state==='cancelled'||data?.state==='unavailable')?<div className="mr-pix-message" role="status">
       <p>{t(data.message||'Não há um pagamento Pix disponível neste momento.')}</p>
       {data.state!=='cancelled'?<button onClick={()=>{setLoading(true);void refresh(orderId);}}>{t('Atualizar pagamento')}</button>:null}
     </div>:null}
     <div className="mr-pix-bottom"><a href="/app">{t('Voltar ao Meu Ritmo')}</a><span>{t('O Meu Ritmo não solicita dados de cartão.')}</span></div>
   </section>
 </main>;
}
