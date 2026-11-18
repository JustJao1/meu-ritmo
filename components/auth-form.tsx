'use client';
import ContextIllustration from './context-illustration';
import {useEffect,useState,type FormEvent} from 'react';
import {safeReturnPath} from '../lib/return-path';
import {passwordMeetsPolicy,PASSWORD_GUIDANCE} from '../lib/password-policy';
import LanguageSelector,{useLocale} from './language-selector';
import TurnstileCaptcha from './turnstile-captcha';

type AuthMode='login'|'signup'|'recover'|'verify'|'password'|'logout';
const titles:Record<AuthMode,string>={
  login:'Bom ter você por aqui.',signup:'Seu espaço começa aqui.',
  recover:'Recupere seu acesso.',verify:'Confira seu e-mail.',
  password:'Escolha uma nova senha.',logout:'Sair da sua conta?'
};
const descriptions:Partial<Record<AuthMode,string>>={
  login:'Entre com o e-mail e a senha usados no cadastro.',
  signup:'Crie sua conta gratuitamente para começar a usar o Meu Ritmo.',
  recover:'Informe o e-mail cadastrado para receber as instruções de recuperação.',
  verify:'Confira sua caixa de entrada e o spam. Digite o código de confirmação recebido para ativar sua conta.',
  password:'Escolha uma nova senha para voltar a acessar sua conta.'
};
export default function AuthForm({mode}:{mode:AuthMode}){
  const {t}=useLocale();
  const [recoveryReady,setRecoveryReady]=useState(false);
  const [recoveryEmail,setRecoveryEmail]=useState('');
  const [pendingEmail,setPendingEmail]=useState('');
  const [verificationType,setVerificationType]=useState<'signup'|'recovery'>('signup');
  const [showPassword,setShowPassword]=useState(false);
  const [newPassword,setNewPassword]=useState('');
  const [signupUsername,setSignupUsername]=useState('');
  const [passwordConfirmation,setPasswordConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [pendingSignup,setPendingSignup]=useState(false);
  const [phone,setPhone]=useState('');
  const [stepUpEnabled,setStepUpEnabled]=useState(false);
  const [loginChallenge,setLoginChallenge]=useState('');
  const [loginCode,setLoginCode]=useState('');
  const [captchaRequired,setCaptchaRequired]=useState(false);
  const [captchaSiteKey,setCaptchaSiteKey]=useState('');
  const [captchaToken,setCaptchaToken]=useState('');
  const [captchaResetKey,setCaptchaResetKey]=useState(0);
  useEffect(()=>{if(mode!=='login'&&mode!=='signup'&&mode!=='recover')return;void fetch('/api/auth/channels',{cache:'no-store'}).then(r=>r.json()).then((v:unknown)=>{const data=v as {stepUpEnabled?:boolean;captchaRequired?:boolean;captchaSiteKey?:string};setStepUpEnabled(Boolean(data?.stepUpEnabled));setCaptchaRequired(Boolean(data?.captchaRequired));setCaptchaSiteKey(data?.captchaSiteKey||'');}).catch(()=>{});},[mode]);
  useEffect(()=>{
    if(mode!=='verify')return;
    // Restore the previous email only on page entry; never overwrite user edits.
    try{setPendingEmail(sessionStorage.getItem('mr-pending-email')||'');}catch{}
  },[mode]);
  useEffect(()=>{
    if(mode==='login'&&new URLSearchParams(location.search).get('password_changed')==='1')
      setMessage(t('Senha alterada. Entre com a nova senha.'));
  },[mode]);
  useEffect(()=>{
    if(mode!=='logout')return;
    try{
      const raw=sessionStorage.getItem('meur ritmo-logout-theme');
      if(!raw)return;
      const theme=JSON.parse(raw),root=document.documentElement;
      const validColor=(v:unknown)=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
      for(const [key,val] of [['--paper',theme.paper],['--ink',theme.ink],['--accent',theme.accent],['--theme-side',theme.side],['--theme-banner',theme.banner]] as const)
        if(validColor(val))root.style.setProperty(key,val);
      if(typeof theme.theme==='string'&&/^[a-z0-9-]{1,40}$/.test(theme.theme))root.dataset.theme=theme.theme;
    }catch{}
  },[mode]);
  useEffect(()=>{
    if(mode!=='password')return;
    const fragment=new URLSearchParams(location.hash.slice(1));
    const access=fragment.get('access_token'),refresh=fragment.get('refresh_token'),type=fragment.get('type');
    if(!access||!refresh||type!=='recovery'){
      // Recovery by six-digit email code sets a short-lived HttpOnly session.
      // The password page must accept it without requiring a link fragment.
      void (async()=>{
        try{
          const r=await fetch('/api/auth/session',{cache:'no-store'});
          const v=await r.json() as {recovery?:boolean;email?:string};
          if(!r.ok||!v.recovery||!v.email)throw Error('recovery_session_missing');
          setRecoveryEmail(v.email);setRecoveryReady(true);setError('');
        }catch{
          setError(t('Abra o link de recuperação recebido por e-mail para definir uma nova senha.'));
        }
      })();
      return;
    }
    history.replaceState(null,'',location.pathname);
    void (async()=>{
      try{
        const r=await fetch('/api/auth/recovery-session',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({access_token:access,refresh_token:refresh})});
        const v=await r.json() as {error?:string;email?:string};
        if(!r.ok)throw Error(v.error||t('Link inválido ou expirado.'));
        if(!v.email)throw Error(t('Não foi possível identificar a conta.'));
        setRecoveryEmail(v.email);setRecoveryReady(true);setError('');
      }catch(e){setError(e instanceof Error?e.message:t('Não foi possível validar o link.'));}
    })();
  },[mode]);
  async function resendSignupCode(){
    if(!pendingEmail.trim()){setError(t('Informe seu e-mail para reenviar o código.'));return;}
    setBusy(true);setError('');setMessage('');
    try{
      const r=await fetch('/api/auth/resend-signup',{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({email:pendingEmail})});
      const v=await r.json() as {error?:string;message?:string};
      if(!r.ok)throw Error(v.error||t('Não foi possível reenviar o código.'));
      setMessage(t(v.message||'Se o cadastro ainda estiver pendente, enviaremos um novo código. Confira também o spam.'));
    }catch(e){setError(e instanceof Error?t(e.message):t('Não foi possível reenviar o código.'));}
    finally{setBusy(false);}
  }
  async function confirmLogin(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/auth/complete-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeId:loginChallenge,code:loginCode})});const v:any=await r.json();if(!r.ok)throw Error(v.error||'Código inválido.');location.href=safeReturnPath(new URLSearchParams(location.search).get('return_to')||'/app');}catch(e){setError(e instanceof Error?t(e.message):t('Não foi possível validar o código.'));}finally{setBusy(false)}}
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const form=new FormData(e.currentTarget),b=Object.fromEntries(form);
    if(mode==='password')b.email=recoveryEmail;
    delete b.passwordConfirmation;
    if(mode==='signup'||mode==='password'){
      if(!passwordMeetsPolicy(newPassword)){setError(t(PASSWORD_GUIDANCE));return;}
      if(newPassword!==passwordConfirmation){setError(t('As senhas não coincidem.'));return;}
    }
    setBusy(true);setError('');setMessage('');setPendingSignup(false);
    try{
      const r=await fetch('/api/auth/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...b,bio:'',captchaToken,accept:form.has('accept'),adult:form.has('adult')})});
      const v:any=await r.json();
      if(mode==='login'&&r.status===202&&v.challengeRequired===true){setLoginChallenge(v.challengeId);setLoginCode('');return;}
      if(!r.ok){if((mode==='signup'||mode==='login')&&v.pendingVerification===true){setPendingSignup(true);try{sessionStorage.setItem('mr-pending-email',String(b.email||''));}catch{}}throw Error(v.error||t('Não foi possível concluir.'));}
      if(mode==='signup'){
        if(v.emailConfirmationRequired===false){
          try{sessionStorage.removeItem('mr-pending-email');}catch{}
          location.href='/app';
        }else{
          try{sessionStorage.setItem('mr-pending-email',String(b.email||''));}catch{}
          location.href='/confirmar-email';
        }
      }else if(mode==='login'){
        location.href=safeReturnPath(new URLSearchParams(location.search).get('return_to')||'/app');
      }else if(mode==='verify'){
        try{sessionStorage.removeItem('mr-pending-email');}catch{}
        location.href=verificationType==='recovery'?'/nova-senha':'/app';
      }else if(mode==='logout'){
        location.href='/';
      }else{
        setMessage(v.message||t('Concluído.'));
      }
    }catch(e){setError(e instanceof Error?t(e.message):t('Não foi possível concluir.'));}
    finally{setBusy(false);if(mode==='signup'||mode==='recover'){setCaptchaToken('');setCaptchaResetKey(v=>v+1);}}
  }
  const needPassword=mode==='login'||mode==='signup'||mode==='password';
  const newPasswordMode=mode==='signup'||mode==='password';
  if(mode==='login'&&loginChallenge)return <main className="authpage"><header className="authheader"><a className="brand" href="/">MR: Meu Ritmo</a><LanguageSelector className="mr-language-auth"/></header><section className="authsheet"><ContextIllustration context="Segurança"/><span className="eyebrow">{t('VERIFICAÇÃO DE SEGURANÇA')}</span><h1>{t('Confirme que é você.')}</h1><p className="muted">{t('Enviamos um código de seis dígitos para seu e-mail.')}</p><form onSubmit={confirmLogin}><label>{t('Código de confirmação')}<input required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={loginCode} onChange={e=>setLoginCode(e.target.value.replace(/\\D/g,'').slice(0,6))}/></label>{error&&<p role="alert" className="autherror">{error}</p>}<button className="primary" disabled={busy||loginCode.length!==6}>{t('Confirmar acesso')}</button><button className="authresend" type="button" disabled={busy} onClick={()=>{setLoginChallenge('');setLoginCode('');}}>{t('Voltar e solicitar outro código')}</button></form></section></main>;
  return <main className="authpage">
    <header className="authheader">
      <a className="brand" href="/" aria-label="MR: Meu Ritmo"><img className="brandmark brandmark-icon" src="/favicon-mr-v3.svg" alt="" width="34" height="34"/>MR: Meu Ritmo<span className="branddot">®</span></a>
      <LanguageSelector className="mr-language-auth"/>
    </header>
    <section className="authsheet"><ContextIllustration context={mode==='verify'?'Opiniões e respostas':['recover','password'].includes(mode)?'Segurança':'Boas-vindas'}/>
      <span className="eyebrow">{t('Seu dia, no seu ritmo').toUpperCase()}</span>
      <h1>{t(titles[mode])}</h1>
      {descriptions[mode]&&<p className="muted">{t(descriptions[mode]!)}</p>}
      <form onSubmit={submit}>
        {mode!=='logout'&&mode!=='password'&&<label>{t('E-mail')}
          <input type="email" name="email" autoComplete="email" maxLength={254} value={mode==='verify'?pendingEmail:undefined} onChange={mode==='verify'?e=>setPendingEmail(e.target.value):undefined} required/>
        </label>}
        {mode==='login'&&stepUpEnabled&&<p className="muted">{t('Após 7 dias desconectado, você confirmará o acesso com um código enviado por e-mail.')}</p>}
        {needPassword&&<label>{t(mode==='password'?'Nova senha':'Senha')}
          <input type={showPassword?'text':'password'} name="password"
            autoComplete={mode==='login'?'current-password':'new-password'}
            minLength={mode==='login'?1:8} maxLength={128}
            value={newPasswordMode?newPassword:undefined}
            onChange={newPasswordMode?e=>setNewPassword(e.target.value):undefined}
            required/>
          <button type="button" className="authshowpassword" onClick={()=>setShowPassword(v=>!v)} aria-pressed={showPassword}>
            {t(showPassword?(newPasswordMode?'Ocultar ambas as senhas':'Ocultar senha'):(newPasswordMode?'Mostrar ambas as senhas':'Mostrar senha'))}
          </button>
          {newPasswordMode&&<small>{t(PASSWORD_GUIDANCE)}</small>}
        </label>}
        {newPasswordMode&&<label>{t('Confirme a nova senha')}
          <input type={showPassword?'text':'password'} name="passwordConfirmation" autoComplete="new-password"
            minLength={8} maxLength={128} value={passwordConfirmation}
            onChange={e=>setPasswordConfirmation(e.target.value)} required/>
        </label>}
        {mode==='signup'&&<>
          <label>{t('Número de contato com DDD')}<input type="tel" inputMode="tel" name="phone" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+55 16 99999-9999" minLength={12} maxLength={24} required/><small>{t('O telefone será mantido como dado de contato e não receberá códigos de segurança.')}</small></label>
          <label>{t('Nome de usuário')}<input name="username" autoComplete="username" required
            pattern="[a-z][a-z0-9_]{2,23}" minLength={3} maxLength={24} value={signupUsername} onChange={e=>setSignupUsername(e.target.value.toLowerCase())}/>
            <small>{t('Comece com uma letra. Use minúsculas, números ou _. Pode mudar a cada 30 dias.')}</small><small>{t('O @usuário é exclusivo. Duas contas não podem usar o mesmo identificador.')}</small>
          </label>
          <label>{t('Nome de exibição')}<input name="name" autoComplete="nickname" required minLength={2} maxLength={50}/>
            <small>{t('Como você aparece no Meu Ritmo. Pode mudar a cada 14 dias.')}</small><small>{t('O nome de exibição pode ser igual ao de outras pessoas. Evite ofensas e imitações de contas oficiais.')}</small>
          </label>
          <label className="checkline"><input type="checkbox" name="accept" required/>
            {t('Li os')} <a href="/termos" target="_blank" rel="noreferrer">{t('termos')}</a> {t('e a')} <a href="/privacidade" target="_blank" rel="noreferrer">{t('política de privacidade')}</a>.
          </label>
          <label className="checkline"><input type="checkbox" name="adult" required/>{t('Tenho 18 anos ou mais.')}</label>
          <p className="muted">{t('Você pode adicionar sua foto depois de criar a conta.')}</p>
        </>}
        {(mode==='signup'||mode==='recover')&&captchaRequired&&(captchaSiteKey?<TurnstileCaptcha siteKey={captchaSiteKey} onToken={setCaptchaToken} resetKey={captchaResetKey}/>:<p role="alert" className="autherror">{t('O CAPTCHA está sendo configurado. Tente novamente mais tarde.')}</p>)}
        {mode==='verify'&&<>
          <p className="muted">{t('Digite o código de seis dígitos enviado ao seu e-mail. Se não recebeu, você pode solicitar outro abaixo.')}</p>
          <label>{t('Qual código você recebeu?')}
            <select name="type" value={verificationType} onChange={e=>setVerificationType(e.target.value as 'signup'|'recovery')}>
              <option value="signup">{t('Código de confirmação de cadastro')}</option>
              <option value="recovery">{t('Código de recuperação de senha')}</option>
            </select>
          </label>
          <label>{t('Código recebido por e-mail')}
            <input name="code" inputMode="numeric" autoComplete="one-time-code"
              pattern="[0-9]{6,10}" minLength={6} maxLength={10} required/>
          </label>
        </>}
        {mode==='logout'&&<p>{t('Seus dados salvos continuam na sua conta.')}</p>}
        {error&&<p role="alert" className="autherror">{error}</p>}
        {(mode==='signup'||mode==='login')&&pendingSignup&&<a className="authpendinglink" href="/confirmar-email">{t('Confirmar meu cadastro anterior')}</a>}
        {message&&<p role="status">{message}</p>}
        {(mode!=='password'||recoveryReady)&&<button className="primary" type="submit" disabled={busy||((mode==='signup'||mode==='recover')&&captchaRequired&&!captchaToken)}>
          {busy?t('Aguarde…'):t({login:'Entrar',signup:'Criar minha conta',recover:'Enviar link de recuperação',verify:'Confirmar código',password:'Salvar nova senha',logout:'Sair da conta'}[mode])}
        </button>}
        {mode==='verify'&&verificationType==='signup'&&<button className="authresend" type="button" onClick={resendSignupCode} disabled={busy}>
          {t('Reenviar código de confirmação')}
        </button>}
      </form>
      <nav className="authlinks">
        {mode==='login'?<>
          <a href="/criar-conta">{t('Criar conta grátis')}</a>
          <a href="/recuperar-senha">{t('Esqueci a senha')}</a>
        </>:<>
          <a href="/entrar">{t('Voltar para entrar')}</a>
          {mode==='password'&&!recoveryReady&&<a href="/recuperar-senha">{t('Solicitar outro link')}</a>}
          {mode==='recover'&&<small>{t('Caso não receba a mensagem, confira o spam e tente novamente mais tarde.')}</small>}
          {mode==='password'&&message&&<a href="/entrar">{t('Entrar com a nova senha')}</a>}
        </>}
      </nav>
    </section>
  </main>;
}
