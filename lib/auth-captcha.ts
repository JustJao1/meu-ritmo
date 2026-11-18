import type {AuthEnv} from './auth-server';

export function captchaConfig(e:AuthEnv){
 const configured=Boolean(e.TURNSTILE_SITE_KEY&&e.TURNSTILE_SECRET_KEY);
 return {configured,required:Boolean(e.TURNSTILE_SITE_KEY||e.TURNSTILE_SECRET_KEY),siteKey:configured?e.TURNSTILE_SITE_KEY:null};
}
export async function verifyAuthCaptcha(e:AuthEnv,request:Request,token:unknown):Promise<{ok:true}|{ok:false;error:string;status:number}>{
 const config=captchaConfig(e);
 if(!config.required)return {ok:true};
 if(!config.configured)return {ok:false,error:'O CAPTCHA está sendo configurado. Tente novamente mais tarde.',status:503};
 if(typeof token!=='string'||token.length<10||token.length>2048)return {ok:false,error:'Confirme a verificação de segurança para continuar.',status:400};
 try{
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({secret:e.TURNSTILE_SECRET_KEY!,response:token,remoteip:request.headers.get('cf-connecting-ip')||''}),
   signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)return {ok:false,error:'A verificação de segurança está indisponível. Tente novamente.',status:503};
  const result=await response.json() as {success?:boolean;hostname?:string};
  if(result.success!==true||result.hostname!==new URL(request.url).hostname)
   return {ok:false,error:'Verificação de segurança inválida ou expirada. Tente novamente.',status:400};
  return {ok:true};
 }catch{return {ok:false,error:'Não foi possível verificar o CAPTCHA agora. Tente novamente.',status:503};}
}
