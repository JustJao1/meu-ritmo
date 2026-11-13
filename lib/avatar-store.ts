import {env} from 'cloudflare:workers';
import {identity} from './auth-context';
import {providerConfig} from './auth-server';
function config(key:string,write=false){const s=identity();if(!s||s.purpose!=='login'||!/^[-\w]+\/[-\w]+\.png$/.test(key)||(write&&!key.startsWith(s.user.userId+'/')))throw Error('avatar_access');return {...providerConfig(env),token:s.accessToken};}
async function call(key:string,method:string,body?:Uint8Array){const c=config(key,method!=='GET');const r=await fetch(c.url+'/storage/v1/object/'+(method==='GET'?'authenticated/':'')+'avatars/'+key,{method,headers:{apikey:c.key,Authorization:'Bearer '+c.token,'Content-Type':'image/png'},...(body?{body:body as BodyInit}:{}),signal:AbortSignal.timeout(10000),redirect:'error'});if(method==='GET'&&r.status===404)return null;if(!r.ok)throw Error('avatar_storage');return r;}
export const avatarStore={async get(k:string){const r=await call(k,'GET');return r?{body:r.body,httpMetadata:{contentType:'image/png'}}:null},async put(k:string,b:Uint8Array){if(b.length>524288)throw Error('avatar_size');await call(k,'POST',b)},async delete(k:string){await call(k,'DELETE')}};
