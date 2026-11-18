import {z} from 'zod';
import {normalizePhone,whatsappReady,shouldChallenge,beginLoginChallenge,completeLoginChallenge,beginPhoneVerification,finishPhoneVerification,type SecureEnv} from './auth-security';
import {profileInput} from './social';
import {passwordMeetsPolicy,PASSWORD_GUIDANCE} from './password-policy';
import {identity} from './auth-context';
import {recoveryRedirect} from './auth-redirect';
import {provider,providerConfig,issueSession,clearCookie,revoke,authRate,finishProfile,hasPendingVerification,verifiedUser,type AuthEnv} from './auth-server';
const email=z.string().trim().toLowerCase().email().max(254),password=z.string().min(8).max(128).refine(passwordMeetsPolicy);
const reply=(v:unknown,status=200,cookie?:string)=>Response.json(v,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function authRoute(req:Request,e:AuthEnv){const action=new URL(req.url).pathname.slice('/api/auth/'.length),s=identity(),securityEnv=e as SecureEnv;if(action==='session'&&req.method==='GET')return reply({authenticated:s?.purpose==='login',recovery:s?.purpose==='recovery',email:s?.purpose==='recovery'?s.user.email:undefined});if(action==='channels'&&req.method==='GET')return reply({email:true,whatsapp:whatsappReady(securityEnv)});if(action==='contact'&&req.method==='GET'){if(s?.purpose!=='login')return reply({error:'Entre na sua conta.'},401);const row=await e.DB!.prepare('SELECT phone,phone_verified_at,preferred_channel FROM auth_contact_methods WHERE user_id=?').bind(s.user.userId).first();return reply({phone:row?.phone||'',verified:!!row?.phone_verified_at,preferredChannel:row?.preferred_channel||'email',whatsappAvailable:whatsappReady(securityEnv)});}if(req.method!=='POST')return reply({error:'Método indisponível.'},405);if(req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Origem inválida.'},403);if(!req.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Envie os campos em JSON.'},415);let stage='request';try{const raw=await req.text();if(raw.length>16000)return reply({error:'Conteúdo muito longo.'},413);const b=JSON.parse(raw);if(action==='logout'){if(s)await revoke(e,s);return reply({ok:true},200,clearCookie())}providerConfig(e);if(action==='recovery-session'){stage='recovery-session';const access=z.string().min(20).max(8192).parse(b.access_token),refresh=z.string().min(1).max(8192).parse(b.refresh_token);const userResponse=await provider(e,'/user',undefined,access);if(!userResponse.ok)return reply({error:'O link de recuperação expirou. Solicite outro.'},401);const user=verifiedUser(await userResponse.json());return reply({ok:true,email:user.email},200,await issueSession(e,{access_token:access,refresh_token:refresh},'recovery'))}if(action==='change-password'){
  if(!s||s.purpose!=='login')return reply({error:'Entre novamente para alterar a senha.'},401);
  stage='change-password';
  if(!await authRate(e,req,action,s.user.email,5))return reply({error:'Muitas tentativas de alteração. Tente novamente mais tarde.'},429);
  const currentPassword=z.string().min(1).max(128).parse(b.currentPassword);
  const newPassword=password.parse(b.newPassword);
  if(currentPassword===newPassword)return reply({error:'Escolha uma senha diferente da atual.'},400);
  const check=await provider(e,'/token?grant_type=password',{email:s.user.email,password:currentPassword});
  if(check.status===429)return reply({error:'Muitas tentativas. Aguarde antes de tentar novamente.'},429);
  if(check.status>=500)return reply({error:'Não foi possível verificar sua senha atual. Tente novamente.'},503);
  if(!check.ok)return reply({error:'A senha atual está incorreta.'},401);
  const verified:any=await check.json();
  const currentUser=verifiedUser(verified.user);
  if(currentUser.userId!==s.user.userId||!verified.access_token)return reply({error:'Não foi possível confirmar a identidade desta conta.'},403);
  const changed=await provider(e,'/user',{password:newPassword},verified.access_token,'PUT');
  if(!changed.ok)return reply({error:'Não foi possível alterar a senha. Confira as regras e tente novamente.'},changed.status>=500?503:400);
  await e.DB!.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(s.user.userId).run();
  await provider(e,'/logout?scope=global',{},verified.access_token).catch(()=>{});
  return reply({ok:true,message:'Senha alterada. Entre novamente com a nova senha.'},200,clearCookie());
}
if(action==='complete-login'){
 stage='complete-login';
 const challengeId=z.string().regex(/^[A-Za-z0-9_-]{48}$/).parse(b.challengeId);
 const code=z.string().regex(/^\d{6}$/).parse(b.code);
 if(!await authRate(e,req,'complete-login',challengeId,10))return reply({error:'Muitas tentativas. Entre novamente.'},429);
 const cookie=await completeLoginChallenge(securityEnv,challengeId,code);
 if(!cookie)return reply({error:'Código inválido, expirado ou já utilizado. Entre novamente para solicitar outro.'},401);
 return reply({ok:true},200,cookie);
}
if(action==='contact'){
 if(s?.purpose!=='login')return reply({error:'Entre novamente para alterar o contato.'},401);
 const actionType=z.enum(['update','send','verify','channel']).parse(b.operation);
 if(!await authRate(e,req,'contact-'+actionType,s.user.email,8))return reply({error:'Aguarde antes de tentar novamente.'},429);
 if(actionType==='update'){
  const phone=normalizePhone(b.phone);
  if(!phone)return reply({error:'Informe telefone com código do país e DDD, como +5516999999999.'},400);
  const pw=z.string().min(1).max(128).parse(b.currentPassword);
  const check=await provider(e,'/token?grant_type=password',{email:s.user.email,password:pw});
  if(!check.ok)return reply({error:'Confirme sua senha atual para alterar o telefone.'},401);
  const profile=verifiedUser((await check.json()).user);
  if(profile.userId!==s.user.userId)return reply({error:'Conta divergente.'},403);
  const time=Math.floor(Date.now()/1000);
  await e.DB!.prepare("INSERT INTO auth_contact_methods(user_id,phone,preferred_channel,updated_at) VALUES (?,?,'email',?) ON CONFLICT(user_id) DO UPDATE SET phone=excluded.phone,phone_verified_at=CASE WHEN auth_contact_methods.phone=excluded.phone THEN auth_contact_methods.phone_verified_at ELSE NULL END,preferred_channel=CASE WHEN auth_contact_methods.phone=excluded.phone THEN auth_contact_methods.preferred_channel ELSE 'email' END,updated_at=excluded.updated_at").bind(s.user.userId,phone,time).run();
  return reply({ok:true,message:'Número salvo. Verifique o WhatsApp antes de usá-lo como canal de segurança.'});
 }
 if(actionType==='send'){
  if(!whatsappReady(securityEnv))return reply({error:'O envio por WhatsApp ainda não está habilitado. Use o e-mail.'},503);
  const details=await beginPhoneVerification(securityEnv,s.user.userId);
  return reply({ok:true,...details});
 }
 if(actionType==='verify'){
  const challengeId=z.string().regex(/^[A-Za-z0-9_-]{48}$/).parse(b.challengeId);
  const code=z.string().regex(/^\d{6}$/).parse(b.code);
  if(!await finishPhoneVerification(securityEnv,s.user.userId,challengeId,code))return reply({error:'Código inválido ou expirado.'},400);
  return reply({ok:true,message:'Telefone verificado. O WhatsApp poderá ser escolhido nos próximos logins.'});
 }
 const channel=z.enum(['email','whatsapp']).parse(b.channel);
 if(channel==='whatsapp'){
  const row=await e.DB!.prepare('SELECT phone_verified_at FROM auth_contact_methods WHERE user_id=?').bind(s.user.userId).first<{phone_verified_at:number|null}>();
  if(!whatsappReady(securityEnv)||!row?.phone_verified_at)return reply({error:'Verifique primeiro o seu telefone por WhatsApp.'},400);
 }
 await e.DB!.prepare("INSERT INTO auth_contact_methods(user_id,preferred_channel,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET preferred_channel=excluded.preferred_channel,updated_at=excluded.updated_at").bind(s.user.userId,channel,Math.floor(Date.now()/1000)).run();
 return reply({ok:true,message:'Canal de segurança atualizado.'});
}
const mail=email.parse(b.email);if(!await authRate(e,req,action,mail,action==='resend-signup'?3:10))return reply({error:'Muitas tentativas. Aguarde uma hora.'},429);if(action==='login'){const pw=z.string().min(1).max(128).parse(b.password),r=await provider(e,'/token?grant_type=password',{email:mail,password:pw});if(!r.ok)return reply({error:'Confira seu e-mail, senha e a confirmação do cadastro.'},401);const v:any=await r.json();const sessionUser=verifiedUser(v.user);if(await hasPendingVerification(e,sessionUser.userId))return reply({error:'Confirme o código enviado por e-mail antes de entrar.',pendingVerification:true},403);
 if(await shouldChallenge(securityEnv,sessionUser.userId)){
  const channel=b.channel==='whatsapp'?'whatsapp':'email';
  const row=await e.DB!.prepare('SELECT phone_verified_at FROM auth_contact_methods WHERE user_id=?').bind(sessionUser.userId).first<{phone_verified_at:number|null}>();
  if(channel==='whatsapp'&&(!whatsappReady(securityEnv)||!row?.phone_verified_at))return reply({error:'Este número ainda não está verificado para receber códigos por WhatsApp. Escolha e-mail.'},400);
  stage='login-challenge';
  const result=await beginLoginChallenge(securityEnv,sessionUser.userId,mail,channel,v);
  return reply({challengeRequired:true,...result},202);
 }
 return reply({ok:true},200,await issueSession(e,v))}
if(action==='resend-signup'){
 stage='resend-signup-provider';
 const r=await provider(e,'/resend',{type:'signup',email:mail});
 if(r.status===429)return reply({error:'Aguarde um pouco antes de solicitar outro código.'},429);
 if(!r.ok){
   console.error('auth_resend_signup_rejected',{status:r.status});
   return reply({error:'Não foi possível solicitar o código agora. Confira o e-mail informado e tente novamente mais tarde.'},r.status>=500?503:400);
 }
 return reply({ok:true,message:'Solicitação de reenvio aceita. Confira a caixa de entrada e o spam.'});
}
if(action==='signup'){stage='signup-validation';const pw=password.parse(b.password),p=profileInput.parse(b),phone=normalizePhone(b.phone);if(!phone)return reply({error:'Informe um número de contato com código do país e DDD.'},400);
 const used=await e.DB!.prepare('SELECT 1 FROM profiles WHERE username=?').bind(p.username).first();
 if(used)return reply({error:'Esse nome de usuário já está em uso.'},409);
 const pending=await e.DB!.prepare('SELECT 1 FROM auth_pending_profiles WHERE username=?').bind(p.username).first();
 if(pending)return reply({error:'Esse nome está reservado por um cadastro aguardando confirmação. Se foi você, abra Confirmar e-mail e reenvie o código usando o e-mail do primeiro cadastro.',pendingVerification:true},409);
 stage='signup-provider-settings';
 const settingsResponse=await provider(e,'/settings');
 if(!settingsResponse.ok)return reply({error:'Não foi possível acessar sua conta agora. Tente novamente em instantes.'},503);
 const settings:any=await settingsResponse.json();
 if(settings.mailer_autoconfirm!==false){
   console.error('auth_signup_provider_confirmation_disabled');
   return reply({error:'A confirmação por código não está ativada no provedor de autenticação. O acesso permanecerá bloqueado até essa configuração ser corrigida.'},503);
 }
 stage='signup-provider';const r=await provider(e,'/signup',{email:mail,password:pw});if(!r.ok)return reply({error:'Não foi possível cadastrar. Confira os dados ou recupere sua senha.'},400);const v:any=await r.json(),id=v.user?.id||v.id;if(!id||!/^[0-9a-f-]{36}$/i.test(id))return reply({error:'Não foi possível registrar o cadastro. Tente novamente.'},503);if(id){stage='signup-pending-profile';const now=Math.floor(Date.now()/1000);await e.DB!.prepare("INSERT INTO auth_contact_methods(user_id,phone,preferred_channel,updated_at) VALUES (?,?,'email',?) ON CONFLICT(user_id) DO UPDATE SET phone=excluded.phone,phone_verified_at=CASE WHEN auth_contact_methods.phone=excluded.phone THEN auth_contact_methods.phone_verified_at ELSE NULL END,updated_at=excluded.updated_at").bind(id,phone,now).run();try{
  await e.DB!.prepare('INSERT INTO auth_pending_profiles(user_id,username,name,accepted_at,created_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,name=excluded.name,accepted_at=excluded.accepted_at').bind(id,p.username,p.name,now,now).run();
}catch(error){
  if(!/unique constraint/i.test(String(error)))throw error;
  // Keep a pending reservation even when another user claimed the requested name.
  // Without it, a provider that auto-confirms email could grant login before any OTP.
  const generatedUsername='pending_'+id.replaceAll('-','').slice(0,16);
  await e.DB!.prepare('INSERT INTO auth_pending_profiles(user_id,username,name,accepted_at,created_at) VALUES (?,?,?,?,?)').bind(id,generatedUsername,p.name,now,now).run();
  if(v.session?.access_token||v.access_token)return reply({error:'A confirmação por código não está ativada no provedor de autenticação. O acesso permanecerá bloqueado até essa configuração ser corrigida.',pendingVerification:true},503);
  return reply({ok:true,message:'Conta criada. Confirme seu e-mail e escolha outro nome de usuário ao entrar.'});
}}if(v.session?.access_token||v.access_token){console.error('auth_signup_provider_auto_confirmed');return reply({error:'A confirmação por código não está ativada no provedor de autenticação. O acesso permanecerá bloqueado até essa configuração ser corrigida.',pendingVerification:true},503)}return reply({ok:true,message:'Confira o código enviado ao seu e-mail.'})}
if(action==='recover'){stage='recovery-provider';const r=await provider(e,'/recover?redirect_to='+encodeURIComponent(recoveryRedirect(req.url)),{email:mail});if(!r.ok){console.error('auth_recovery_provider_rejected',{status:r.status});if(r.status===429)return reply({error:'O envio de e-mails está temporariamente limitado. Aguarde antes de tentar novamente.'},429);if(r.status>=500)return reply({error:'O serviço de e-mail está indisponível no momento. Tente novamente mais tarde.'},503);return reply({error:'Não foi possível solicitar a recuperação agora. Tente novamente mais tarde.'},400)}return reply({ok:true,message:'Se houver uma conta para este e-mail, você receberá uma mensagem com as instruções de recuperação. Confira também a pasta de spam.'})}
if(action==='verify'){const type=z.enum(['signup','recovery']).parse(b.type),token=z.string().regex(/^\d{6,10}$/).parse(b.code),r=await provider(e,'/verify',{email:mail,token,type});if(!r.ok)return reply({error:'Código inválido ou expirado. Solicite outro.'},400);const v:any=await r.json();if(type==='signup')await finishProfile(e,verifiedUser(v.user));return reply({ok:true},200,await issueSession(e,v,type==='recovery'?'recovery':'login'))}
if(action==='password'){if(!s||s.purpose!=='recovery'||s.createdAt<Math.floor(Date.now()/1000)-600||s.user.email.toLowerCase()!==mail)return reply({error:'O link de recuperação não foi validado ou expirou. Solicite um novo link por e-mail.'},401);const pw=password.parse(b.password),r=await provider(e,'/user',{password:pw},s.accessToken,'PUT');if(!r.ok)return reply({error:'Não foi possível atualizar a senha.'},400);await provider(e,'/logout?scope=global',{},s.accessToken);await e.DB!.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(s.user.userId).run();return reply({ok:true,message:'Senha atualizada. Entre novamente.'},200,clearCookie())}
return reply({error:'Não encontrado.'},404)}catch(err){if(err instanceof z.ZodError||err instanceof SyntaxError)return reply({error:action==='recovery-session'?'O link de recuperação não pôde ser validado. Solicite um novo link.':action==='password'||action==='change-password'?PASSWORD_GUIDANCE:'Confira os campos. '+PASSWORD_GUIDANCE+' Os dados de cadastro e os consentimentos também são obrigatórios.'},400);const detail=err instanceof Error?err.message:'';const failureCode=/fetch failed|fetch\(\) failed|network|connection/i.test(detail)?'network_failure':/invalid url|failed to parse url/i.test(detail)?'invalid_url':/timeout|timed out/i.test(detail)?'timeout':/redirect/i.test(detail)?'redirect':/illegal invocation/i.test(detail)?'runtime_invocation':/invalid header|header value/i.test(detail)?'invalid_header':'unclassified';console.error('auth_failure',{action,stage,errorType:err instanceof Error?err.name:'UnknownError',failureCode});return reply({error:'Não foi possível acessar sua conta agora. Tente novamente em instantes.'},503)}}
