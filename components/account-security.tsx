'use client';
import {useEffect,useState} from 'react';
import {useLocale} from './language-selector';
type Contact={phone:string;verified:boolean;preferredChannel:'email'|'whatsapp';whatsappAvailable:boolean;stepUpEnabled:boolean};
export default function AccountSecurity(){
 const {t}=useLocale();
 const [contact,setContact]=useState<Contact|null>(null),[phone,setPhone]=useState(''),[password,setPassword]=useState(''),[channel,setChannel]=useState<'email'|'whatsapp'>('email');
 const [challengeId,setChallengeId]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{const r=await fetch('/api/auth/contact',{cache:'no-store'});const data:any=await r.json();if(!r.ok)throw Error(data.error);setContact(data);setPhone(data.phone||'');setChannel(data.preferredChannel==='whatsapp'?'whatsapp':'email');};
 useEffect(()=>{void load().catch(e=>setError(e instanceof Error?e.message:'Não foi possível carregar seu contato.'));},[]);
 async function post(body:Record<string,unknown>){setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/auth/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),v:any=await r.json();if(!r.ok)throw Error(v.error||'Não foi possível atualizar.');setNotice(v.message||'Atualizado.');await load();return v;}catch(e){setError(e instanceof Error?t(e.message):t('Não foi possível atualizar.'));return null;}finally{setBusy(false);}}
 return <section className="account-security"><p>{t('Seu número é usado somente para recuperar e proteger o acesso. Para mensagens pelo WhatsApp, primeiro é necessário confirmar a posse desse número.')}</p>
 {error&&<p role="alert" className="autherror">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <form onSubmit={async e=>{e.preventDefault();const v=await post({operation:'update',phone,currentPassword:password});if(v){setPassword('');setChallengeId('');}}}>
 <label>{t('Número de contato com DDD')}<input type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+55 16 99999-9999" required/></label>
 <label>{t('Confirme sua senha atual')}<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
 <button type="submit" disabled={busy||!phone||!password}>{t('Salvar número')}</button></form>
 <p className="muted">{contact?.verified?t('Telefone verificado'):t('Telefone não verificado')}</p>
 {contact?.whatsappAvailable?<div className="account-security-phone">{!contact.verified&&<button disabled={busy} onClick={async()=>{const v=await post({operation:'send'});if(v)setChallengeId(v.challengeId);}}>{t('Enviar código para verificar o WhatsApp')}</button>}
 {challengeId&&<form onSubmit={async e=>{e.preventDefault();if(await post({operation:'verify',challengeId,code})){setChallengeId('');setCode('');}}}><label>{t('Código recebido pelo WhatsApp')}<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} maxLength={6} required/></label><button disabled={busy||code.length!==6}>{t('Confirmar telefone')}</button></form>}</div>:<p className="muted">{t('O canal WhatsApp ainda depende da ativação do serviço de envio. Enquanto isso, os códigos continuam disponíveis por e-mail.')}</p>}
 {contact?.stepUpEnabled&&<form onSubmit={async e=>{e.preventDefault();await post({operation:'channel',channel});}}><label>{t('Canal preferido para confirmar seu login')}<select value={channel} onChange={e=>setChannel(e.target.value as 'email'|'whatsapp')}><option value="email">{t('E-mail')}</option><option value="whatsapp" disabled={!contact?.verified||!contact?.whatsappAvailable}>{t('WhatsApp')}</option></select></label><button disabled={busy}>{t('Salvar preferência')}</button></form>}
 <p className="muted">{t(contact?.stepUpEnabled?'Uma nova confirmação é exigida quando sua conta fica desconectada por pelo menos 24 horas. Sessões existentes não são encerradas por essa configuração.':'A verificação adicional de login será disponibilizada após a homologação do envio de códigos. Seu acesso atual continua funcionando normalmente.')}</p>
 </section>;
}
