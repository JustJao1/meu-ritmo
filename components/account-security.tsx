'use client';
import {useEffect,useState} from 'react';
import {useLocale} from './language-selector';

type Contact={phone:string;stepUpEnabled:boolean};

export default function AccountSecurity(){
 const {t}=useLocale();
 const [contact,setContact]=useState<Contact|null>(null);
 const [phone,setPhone]=useState('');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');

 async function load(){
  const response=await fetch('/api/auth/contact',{cache:'no-store'});
  const data:any=await response.json();
  if(!response.ok)throw Error(data.error||'Não foi possível carregar seu contato.');
  setContact({phone:data.phone||'',stepUpEnabled:!!data.stepUpEnabled});
  setPhone(data.phone||'');
 }
 useEffect(()=>{void load().catch(e=>setError(e instanceof Error?t(e.message):t('Não foi possível carregar seu contato.')));},[]);

 async function updatePhone(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/auth/contact',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({operation:'update',phone,currentPassword:password})
   });
   const data:any=await response.json();
   if(!response.ok)throw Error(data.error||'Não foi possível atualizar.');
   setPassword('');setNotice(t('Telefone atualizado.'));
   await load();
  }catch(e){setError(e instanceof Error?t(e.message):t('Não foi possível atualizar.'));}
  finally{setBusy(false);}
 }

 return <section className="account-security">
  <p>{t('Os códigos de segurança e de recuperação de senha são enviados por e-mail. O telefone fica salvo como dado de contato e não recebe códigos.')}</p>
  {error&&<p role="alert" className="autherror">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  <form onSubmit={updatePhone}>
   <label>{t('Número de contato com DDD')}
    <input type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+55 16 99999-9999" required/>
   </label>
   <label>{t('Confirme sua senha atual')}
    <input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/>
   </label>
   <button type="submit" disabled={busy||!phone||!password}>{busy?t('Salvando…'):t('Salvar número')}</button>
  </form>
  <p className="muted">{t(contact?.stepUpEnabled?
   'Após 7 dias desconectado, a confirmação adicional de login será feita por e-mail.':
   'A verificação adicional de login será disponibilizada após a homologação do envio de códigos. Seu acesso atual continua funcionando normalmente.')}</p>
 </section>;
}
