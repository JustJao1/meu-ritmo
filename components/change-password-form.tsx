'use client';
import {useState,type FormEvent} from 'react';
import {useLocale} from './language-selector';
import {passwordMeetsPolicy,PASSWORD_GUIDANCE} from '../lib/password-policy';

export default function ChangePasswordForm(){
  const {t}=useLocale();
  const [currentPassword,setCurrentPassword]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [visible,setVisible]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    setError('');
    if(!passwordMeetsPolicy(newPassword)){setError(t(PASSWORD_GUIDANCE));return;}
    if(newPassword!==confirmation){setError(t('As senhas não coincidem.'));return;}
    if(currentPassword===newPassword){setError(t('Escolha uma senha diferente da atual.'));return;}
    setBusy(true);
    try{
      const response=await fetch('/api/auth/change-password',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({currentPassword,newPassword})
      });
      const result=await response.json() as {error?:string};
      if(!response.ok)throw Error(result.error||t('Não foi possível alterar a senha.'));
      // The server expires all existing sessions. Never retain a stale logged-in page.
      location.replace('/entrar?password_changed=1');
    }catch(e){setError(e instanceof Error?t(e.message):t('Não foi possível alterar a senha.'));}
    finally{setBusy(false);}
  }
  return <form onSubmit={save} className="passwordchangeform">
    <p className="muted">{t('Informe sua senha atual para confirmar que esta conta é sua. Depois escolha a nova senha.')}</p>
    <label>{t('Senha atual')}
      <input type={visible?'text':'password'} autoComplete="current-password"
        maxLength={128} required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/>
    </label>
    <label>{t('Nova senha')}
      <input type={visible?'text':'password'} autoComplete="new-password"
        minLength={8} maxLength={128} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
      <small>{t(PASSWORD_GUIDANCE)}</small>
    </label>
    <label>{t('Confirme a nova senha')}
      <input type={visible?'text':'password'} autoComplete="new-password"
        minLength={8} maxLength={128} required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/>
    </label>
    <button type="button" className="secondary" onClick={()=>setVisible(v=>!v)} aria-pressed={visible}>
      {t(visible?'Ocultar senha':'Mostrar senha')}
    </button>
    {error&&<p className="autherror" role="alert">{error}</p>}
    <p className="muted">{t('Após alterar, você precisará entrar novamente em seus dispositivos.')}</p>
    <button type="submit" className="primary" disabled={busy}>{busy?t('Aguarde…'):t('Salvar nova senha')}</button>
  </form>;
}
