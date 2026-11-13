import {env} from 'cloudflare:workers';
import type {SessionUser} from '../app/session';
export type AppRole='owner'|'admin'|'user';
export function ownerEmail(){return ((env as unknown as Record<string,string>).ADMIN_OWNER_EMAIL||'').trim().toLowerCase();}
export function ownerUserId(){return ((env as unknown as Record<string,string>).ADMIN_OWNER_USER_ID||'').trim();}
export async function registerMember(user:SessionUser){if(!user.email)return;const now=Math.floor(Date.now()/1000);await env.DB!.prepare('INSERT INTO app_members(user_id,email,display_name,created_at,last_seen) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,last_seen=excluded.last_seen').bind(user.userId,user.email.trim().toLowerCase(),user.fullName||user.displayName||user.email,now,now).run();}
export async function appRole(user:SessionUser):Promise<AppRole>{if(ownerUserId()===user.userId&&ownerEmail()&&user.email?.trim().toLowerCase()===ownerEmail())return 'owner';return await env.DB!.prepare('SELECT user_id FROM app_admins WHERE user_id=?').bind(user.userId).first()?'admin':'user';}
export function sameOrigin(req:Request){return req.headers.get('origin')===new URL(req.url).origin;}
export function auditStatement(user:SessionUser,action:string,target:string,details:Record<string,unknown>){return env.DB!.prepare('INSERT INTO app_audit(id,actor_id,actor_email,action,target,details,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,user.email,action,target,JSON.stringify(details),Math.floor(Date.now()/1000));}
