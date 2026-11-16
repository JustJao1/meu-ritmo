'use client';
import QuietIllustration from '../../components/quiet-illustration';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Download,Smartphone,Share2,Check,MonitorSmartphone} from 'lucide-react';
import {useLocale} from '../../components/language-selector';
import LanguageSelector from '../../components/language-selector';
import {themes} from '../../lib/plans';
import android from '../../public/android-version.json';

type InstallPrompt=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};

export default function DownloadPage(){
 const {t}=useLocale();
 const [installEvent,setInstallEvent]=useState<InstallPrompt|null>(null);
 const [installed,setInstalled]=useState(false);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const requested=params.get('theme');
  const theme=themes.find(x=>x.id===requested)||themes[0];
  const color=params.get('accent');
  const accent=color&&/^#[0-9a-f]{6}$/i.test(color)?color:theme.accent;
  const root=document.documentElement;
  root.dataset.theme=theme.id;
  root.style.setProperty('--paper',theme.paper);
  root.style.setProperty('--ink',theme.ink);
  root.style.setProperty('--theme-side',theme.side);
  root.style.setProperty('--theme-banner',theme.banner);
  root.style.setProperty('--accent',accent);
  const onPrompt=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallPrompt)};
  const onInstalled=()=>{setInstalled(true);setInstallEvent(null)};
  window.addEventListener('beforeinstallprompt',onPrompt);
  window.addEventListener('appinstalled',onInstalled);
  return ()=>{window.removeEventListener('beforeinstallprompt',onPrompt);window.removeEventListener('appinstalled',onInstalled)};
 },[]);
 async function install(){
  if(!installEvent)return;
  await installEvent.prompt();
  await installEvent.userChoice;
  setInstallEvent(null);
 }
 return <div className="downloadpage">
  <header className="downloadheader">
   <a className="downloadbrand" href="/"><img src="/favicon-mr-v3.svg" width={36} height={36} alt=""/>MR: Meu Ritmo</a>
   <LanguageSelector className="mr-language-download"/>
  </header>
  <main className="downloadmain"><QuietIllustration kind="devices"/>
   <span className="downloadebrow">{t('MEU RITMO APP')}</span>
   <h1>{t('Seu espaço, sempre por perto.')}</h1>
   <p className="downloadlead">{t('Use a mesma conta do site para acompanhar seus compromissos, tarefas, notas e finanças no celular.')}</p>
   <div className="downloadgrid">
    <section className="downloadcard">
     <div className="downloadicon"><Smartphone size={25}/></div>
     <h2>{t('Aplicativo para Android')}</h2>
     <p>{t('Instale o APK oficial do Meu Ritmo. Entre com a mesma conta utilizada no site.')}</p>
     <a className="downloadprimary" href={android.apkUrl} rel="noreferrer">
      <Download size={19}/>{t('Baixar APK')} <ArrowUpRight size={17}/>
     </a>
     <small>{t('Versão')} {android.versionName} · {t('Android')}</small>
     <p className="downloadhint">{t('O APK é distribuído pelo GitHub. Confira a versão e autorize a instalação apenas se você confia no arquivo.')}</p>
    </section>
    <section className="downloadcard">
     <div className="downloadicon"><MonitorSmartphone size={25}/></div>
     <h2>{t('Instalar como aplicativo')}</h2>
     <p>{t('No iPhone, abra o Meu Ritmo no Safari, toque em Compartilhar e escolha Adicionar à Tela de Início. No Android, o navegador também pode oferecer a instalação.')}</p>
     <a className="downloadsecondary" href="/app">{t('Abrir Meu Ritmo')} <ArrowUpRight size={17}/></a>
     {installEvent&&!installed&&<button type="button" className="downloadinstall" onClick={()=>void install()}><Share2 size={18}/>{t('Instalar neste dispositivo')}</button>}
     {installed&&<p className="downloadinstalled"><Check size={16}/>{t('Aplicativo instalado neste dispositivo.')}</p>}
    </section>
   </div>
   <p className="downloadnotice">{t('O app e o site compartilham a conta e os dados do Meu Ritmo. Os pagamentos e assinaturas dependem das funcionalidades disponíveis no servidor.')}</p>
   <a href="/app" className="downloadback">{t('Voltar ao meu espaço')} <ArrowUpRight size={15}/></a>
  </main>
 </div>;
}
