import {redirect} from 'next/navigation';
import {identity} from '../lib/auth-context';
export type {SessionUser} from '../lib/auth-context';
export async function getUser(){const s=identity();return s?.purpose==='login'?s.user:null;}
export async function requireUser(path:string){const u=await getUser();if(!u)redirect(signInPath(path));return u;}
import {safeReturnPath} from '../lib/return-path';
export const signInPath=(path='/app')=>'/entrar?return_to='+encodeURIComponent(safeReturnPath(path));
export const signOutPath=(_path='/')=>'/sair';
