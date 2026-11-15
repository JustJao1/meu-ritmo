'use client';
import {useLocale} from '../components/language-selector';
export default function ErrorPage({reset}:{reset:()=>void}){
 const {t}=useLocale();
 return <main className="registration">
   <h1>{t('Não foi possível abrir esta área.')}</h1>
   <p>{t('Tente novamente. Se continuar, volte ao início e consulte o atendimento.')}</p>
   <button className="primary" onClick={reset}>{t('Tentar novamente')}</button>
   <p><a href="/">{t('Voltar ao início')}</a></p>
 </main>;
}
