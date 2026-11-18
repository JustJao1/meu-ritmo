import {hash,provider,verifiedUser,issueSession,seal,unseal,type AuthEnv} from './auth-server';
const now=()=>Math.floor(Date.now()/1000);
const encoder=new TextEncoder();
export type SecureEnv=AuthEnv&{
 WHATSAPP_ACCESS_TOKEN?:string;WHATSAPP_PHONE_NUMBER_ID?:string;
 WHATSAPP_AUTH_TEMPLATE?:string;WHATSAPP_TEMPLATE_LANGUAGE?:string;LOGIN_STEP_UP_ENABLED?:string;WHATSAPP_VERIFICATION_ENABLED?:string;
};
export const normalizePhone=(input:unknown)=>{
 if(typeof input!=='string')return null;
 const value=input.replace(/[\s()-]/g,'');
 return /^\+[1-9]\d{9,14}$/.test(value)?value:null;
};
export const whatsappReady=(e:SecureEnv)=>Boolean(
 e.WHATSAPP_VERIFICATION_ENABLED==='true'&&e.WHATSAPP_ACCESS_TOKEN&&e.WHATSAPP_PHONE_NUMBER_ID&&
 /^\d{8,30}$/.test(e.WHATSAPP_PHONE_NUMBER_ID)&&
 e.WHATSAPP_AUTH_TEMPLATE&&/^[a-z0-9_]{3,100}$/.test(e.WHATSAPP_AUTH_TEMPLATE)
);
const opaque=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(36)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/g,'');
const otpCode=()=>String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
export async function secureCodeHash(e:SecureEnv,challenge:string,code:string){
 const key=await crypto.subtle.importKey('raw',encoder.encode(e.SESSION_ENCRYPTION_KEY||''),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=await crypto.subtle.sign('HMAC',key,encoder.encode(challenge+':'+code));
 return Array.from(new Uint8Array(sig)).map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function sendWhatsAppCode(e:SecureEnv,phone:string,code:string){
 if(!whatsappReady(e))throw Error('whatsapp_not_configured');
 const payload={messaging_product:'whatsapp',to:phone.replace(/\D/g,''),type:'template',
  template:{name:e.WHATSAPP_AUTH_TEMPLATE,language:{code:e.WHATSAPP_TEMPLATE_LANGUAGE||'pt_BR'},components:[
   {type:'body',parameters:[{type:'text',text:code}]},
   {type:'button',sub_type:'url',index:'0',parameters:[{type:'text',text:code}]}
  ]}};
 const r=await fetch('https://graph.facebook.com/v26.0/'+e.WHATSAPP_PHONE_NUMBER_ID+'/messages',{
  method:'POST',headers:{Authorization:'Bearer '+e.WHATSAPP_ACCESS_TOKEN,'Content-Type':'application/json'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)
 });
 if(!r.ok)throw Error('whatsapp_send_failed');
 return true;
}
export async function shouldChallenge(e:SecureEnv,userId:string){
 const current=now();
 const contact=await e.DB!.prepare('SELECT disconnected_at FROM auth_contact_methods WHERE user_id=?').bind(userId).first<{disconnected_at:number|null}>();
 const active=await e.DB!.prepare("SELECT COUNT(*) AS count FROM auth_sessions WHERE user_id=? AND purpose='login' AND expires_at>?").bind(userId,current).first<{count:number}>();
 if((active?.count||0)>0)return false;
 if(contact?.disconnected_at!=null)return current-contact.disconnected_at>=86400;
 const last=await e.DB!.prepare("SELECT MAX(expires_at) AS last FROM auth_sessions WHERE user_id=? AND purpose='login'").bind(userId).first<{last:number|null}>();
 // On an unknown historical state, require the additional code rather than silently bypass it.
 return last?.last==null||current-last.last>=86400;
}
export async function beginLoginChallenge(e:SecureEnv,userId:string,email:string,channel:'email'|'whatsapp',passwordSession:any){
 const id=opaque(),idHash=await hash(id),time=now(),expiry=time+600;
 const contact=await e.DB!.prepare('SELECT phone,phone_verified_at FROM auth_contact_methods WHERE user_id=?').bind(userId).first<{phone:string|null;phone_verified_at:number|null}>();
 if(channel==='whatsapp'&&(!whatsappReady(e)||!contact?.phone||!contact.phone_verified_at))
  throw Error('whatsapp_unavailable');
 const code=channel==='whatsapp'?otpCode():'';
 const codeHash=code?await secureCodeHash(e,id,code):null;
 await e.DB!.prepare('DELETE FROM auth_login_challenges WHERE user_id=? OR expires_at<?').bind(userId,time).run();
 await e.DB!.prepare('INSERT INTO auth_login_challenges(id_hash,user_id,email,tokens,channel,code_hash,expires_at,last_sent_at,attempts) VALUES (?,?,?,?,?,?,?,?,0)').bind(idHash,userId,email,await seal(e,{access_token:passwordSession.access_token,refresh_token:passwordSession.refresh_token}),channel,codeHash,expiry,time).run();
 try{
  if(channel==='whatsapp')await sendWhatsAppCode(e,contact!.phone!,code);
  else{
   // Supabase sends the existing six-digit email OTP template. Do not create a user.
   const r=await provider(e,'/otp',{email,create_user:false});
   if(!r.ok)throw Error('email_otp_send_failed');
  }
 }catch(error){
  await e.DB!.prepare('DELETE FROM auth_login_challenges WHERE id_hash=?').bind(idHash).run();
  throw error;
 }
 return {challengeId:id,channel,expiresIn:600};
}
export async function completeLoginChallenge(e:SecureEnv,id:string,code:string){
 const idHash=await hash(id),time=now();
 const row=await e.DB!.prepare('SELECT * FROM auth_login_challenges WHERE id_hash=? AND expires_at>? AND attempts<5').bind(idHash,time).first<{user_id:string;email:string;channel:string;code_hash:string|null;tokens:string;attempts:number}>();
 if(!row)return null;
 const attempt=await e.DB!.prepare('UPDATE auth_login_challenges SET attempts=attempts+1 WHERE id_hash=? AND attempts<5 AND expires_at>?').bind(idHash,time).run();
 if(!attempt.meta.changes)return null;
 let verified:any;
 if(row.channel==='email'){
  const response=await provider(e,'/verify',{email:row.email,token:code,type:'email'});
  if(!response.ok)return null;
  verified=await response.json();
 }else{
  const expected=await secureCodeHash(e,id,code);
  if(!row.code_hash||expected.length!==row.code_hash.length)return null;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^row.code_hash.charCodeAt(i);
  if(diff)return null;
  verified=await unseal(e,row.tokens);
  const r=await provider(e,'/user',undefined,verified.access_token);
  if(!r.ok)return null;
  verified.user=await r.json();
 }
 const user=verifiedUser(verified.user);
 if(user.userId!==row.user_id||user.email.toLowerCase()!==row.email.toLowerCase())return null;
 // Consume the one-use challenge before issuing session; a failed issue requires a fresh login.
 const consumed=await e.DB!.prepare('DELETE FROM auth_login_challenges WHERE id_hash=?').bind(idHash).run();
 if(!consumed.meta.changes)return null;
 return issueSession(e,verified);
}

export async function beginPhoneVerification(e:SecureEnv,userId:string){
 if(!whatsappReady(e))throw Error('whatsapp_not_configured');
 const row=await e.DB!.prepare('SELECT phone FROM auth_contact_methods WHERE user_id=?').bind(userId).first<{phone:string|null}>();
 if(!row?.phone)throw Error('phone_missing');
 const phone=normalizePhone(row.phone);if(!phone)throw Error('phone_invalid');
 const id=opaque(),idHash=await hash(id),code=otpCode(),time=now();
 const codeHash=await secureCodeHash(e,id,code);
 await e.DB!.prepare('DELETE FROM auth_phone_challenges WHERE user_id=? OR expires_at<?').bind(userId,time).run();
 await e.DB!.prepare('INSERT INTO auth_phone_challenges(id_hash,user_id,phone,code_hash,expires_at,attempts) VALUES (?,?,?,?,?,0)').bind(idHash,userId,phone,codeHash,time+600).run();
 try{await sendWhatsAppCode(e,phone,code);}catch(error){await e.DB!.prepare('DELETE FROM auth_phone_challenges WHERE id_hash=?').bind(idHash).run();throw error;}
 return {challengeId:id,expiresIn:600};
}
export async function finishPhoneVerification(e:SecureEnv,userId:string,id:string,code:string){
 const idHash=await hash(id),time=now();
 const row=await e.DB!.prepare('SELECT user_id,phone,code_hash FROM auth_phone_challenges WHERE id_hash=? AND user_id=? AND expires_at>? AND attempts<5').bind(idHash,userId,time).first<{user_id:string;phone:string;code_hash:string}>();
 if(!row)return false;
 const attempt=await e.DB!.prepare('UPDATE auth_phone_challenges SET attempts=attempts+1 WHERE id_hash=? AND attempts<5 AND expires_at>?').bind(idHash,time).run();
 if(!attempt.meta.changes)return false;
 const expected=await secureCodeHash(e,id,code);
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^row.code_hash.charCodeAt(i);
 if(diff)return false;
 const current=await e.DB!.prepare('SELECT phone FROM auth_contact_methods WHERE user_id=?').bind(userId).first<{phone:string|null}>();
 if(current?.phone!==row.phone)return false;
 const consumed=await e.DB!.prepare('DELETE FROM auth_phone_challenges WHERE id_hash=?').bind(idHash).run();
 if(!consumed.meta.changes)return false;
 await e.DB!.prepare("UPDATE auth_contact_methods SET phone_verified_at=?,preferred_channel='whatsapp',updated_at=? WHERE user_id=? AND phone=?").bind(time,time,userId,row.phone).run();
 return true;
}
