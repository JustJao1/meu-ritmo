'use client';
import {useEffect,useState} from 'react';
export type Locale='pt-BR'|'en'|'es';
export const languageNames:Record<Locale,string>={'pt-BR':'Português (Brasil)',en:'English',es:'Español'};
const translations:Record<string,[string,string]>={
'Hoje':['Today','Hoy'],'Agenda':['Calendar','Agenda'],'Gastos':['Finances','Gastos'],'Notas':['Notes','Notas'],'Rotina':['Routine','Rutina'],'Comunidade':['Community','Comunidad'],
'Meu espaço':['My space','Mi espacio'],'Pessoal':['Personal','Personal'],'Guia e ajuda':['Guide and help','Guía y ayuda'],'Meu estilo':['My style','Mi estilo'],'Configurações':['Settings','Configuración'],'Privacidade e dados':['Privacy and data','Privacidad y datos'],
'Entrar':['Sign in','Iniciar sesión'],'Criar minha conta':['Create my account','Crear mi cuenta'],'E-mail':['Email','Correo electrónico'],'Senha':['Password','Contraseña'],'Nova senha':['New password','Nueva contraseña'],
'Bom ter você por aqui.':['Good to see you.','Qué bueno verte.'],'Seu espaço começa aqui.':['Your space starts here.','Tu espacio empieza aquí.'],'Recupere seu acesso.':['Recover your account.','Recupera tu acceso.'],'Confira seu e-mail.':['Check your email.','Revisa tu correo.'],'Escolha uma nova senha.':['Choose a new password.','Elige una nueva contraseña.'],'Sair da sua conta?':['Sign out?','¿Cerrar sesión?'],
'Enviar link de recuperação':['Send recovery link','Enviar enlace de recuperación'],'Salvar nova senha':['Save new password','Guardar nueva contraseña'],'Voltar para entrar':['Back to sign in','Volver a iniciar sesión'],
'Administração':['Administration','Administración'],'Demonstração':['Demo','Demostración'],'Idioma':['Language','Idioma'],'Seu dia, no seu ritmo':['Your day, your rhythm','Tu día, a tu ritmo']
};
export function translate(value:string,locale:Locale){const pair=translations[value];return locale==='en'?pair?.[0]||value:locale==='es'?pair?.[1]||value:value;}
export function readLocale():Locale{if(typeof window==='undefined')return 'pt-BR';try{const v=localStorage.getItem('mr-language');return v==='en'||v==='es'?v:'pt-BR';}catch{return 'pt-BR';}}
export function useLocale(){const [locale,setLocale]=useState<Locale>('pt-BR');useEffect(()=>{const sync=()=>{const l=readLocale();setLocale(l);document.documentElement.lang=l;};sync();window.addEventListener('mr-language-change',sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener('mr-language-change',sync);window.removeEventListener('storage',sync);};},[]);const changeLocale=(l:Locale)=>{try{localStorage.setItem('mr-language',l);}catch{}document.documentElement.lang=l;setLocale(l);window.dispatchEvent(new Event('mr-language-change'));};return {locale,changeLocale,t:(value:string)=>translate(value,locale)};}
export default function LanguageSelector({className=''}:{className?:string}){const {locale,changeLocale,t}=useLocale();return <label className={'mr-language-selector '+className}><span>{t('Idioma')}</span><select aria-label={t('Idioma')} value={locale} onChange={e=>changeLocale(e.target.value as Locale)}>{(Object.keys(languageNames) as Locale[]).map(l=><option key={l} value={l}>{languageNames[l]}</option>)}</select></label>;}
