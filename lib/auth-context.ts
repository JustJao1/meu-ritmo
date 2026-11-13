import {AsyncLocalStorage} from 'node:async_hooks';
export type SessionUser={userId:string;email:string;displayName:string;fullName:string|null};
export type Identity={user:SessionUser;hash:string;accessToken:string;refreshToken:string;purpose:'login'|'recovery';createdAt:number};
const context=new AsyncLocalStorage<Identity|null>();
export const withIdentity=<T>(value:Identity|null,fn:()=>T)=>context.run(value,fn);
export const identity=()=>context.getStore()||null;
