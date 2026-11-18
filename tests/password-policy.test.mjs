import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const folder=await mkdtemp(join(tmpdir(),'ritmo-password-'));
const originalPolicy='lib/password-policy.ts';
const providerCalls=[];
const testUserId='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const testUser={id:testUserId,email:'person@example.test',email_confirmed_at:'2026-11-14'};
globalThis.__authIdentity=null;
globalThis.__providerAutoConfirm=false;
globalThis.__mockProvider=async(path,body,token,method)=>{
 providerCalls.push({path,body,token,method});
 if(path==='/settings')return Response.json({mailer_autoconfirm:globalThis.__providerAutoConfirm});
 if(path.includes('/token?grant_type=password')){
   if(body.password==='Wrong1!')return Response.json({error:'invalid_grant'},{status:400});
   return Response.json({access_token:'recent-token',user:testUser});
 }
 if(path==='/user'&&method==='PUT')return Response.json(testUser);
 if(path==='/signup')return Response.json({user:testUser});
 return Response.json({access_token:'login-token',refresh_token:'refresh-token',user:testUser});
};
const mock={name:'mock-auth-dependencies',setup(buildApi){
 buildApi.onResolve({filter:/^\.\/(auth-server|auth-context|social|auth-security)$/},args=>({path:args.path,namespace:'mock-auth'}));
 buildApi.onLoad({filter:/.*/,namespace:'mock-auth'},args=>{
  if(args.path==='./auth-context')return {contents:'export const identity=()=>globalThis.__authIdentity;',loader:'js'};
  if(args.path==='./social')return {contents:'export const profileInput={parse:v=>v};',loader:'js'};
  if(args.path==='./auth-security')return {loader:'js',contents:`export const normalizePhone=v=>/^\\+[1-9]\\d{9,14}$/.test(String(v))?v:null; export const whatsappReady=()=>false; export const shouldChallenge=async()=>false; export const beginLoginChallenge=async()=>({}); export const completeLoginChallenge=async()=>null; export const beginPhoneVerification=async()=>({}); export const finishPhoneVerification=async()=>false;`};
  return {loader:'ts',contents:`
    export type AuthEnv=any;
    export const providerConfig=()=>({});
    export const provider=(e,path,body,token,method)=>globalThis.__mockProvider(path,body,token,method);
    export const verifiedUser=v=>({userId:v.id,email:v.email});
    export const issueSession=async()=> 'secure-test-cookie';
    export const clearCookie=()=> 'cleared-test-cookie';
    export const revoke=async()=>{};
    export const authRate=async()=>true;
    export const finishProfile=async()=>{};
    export const hasPendingVerification=async()=>false;
  `};
 });
}};
await build({entryPoints:[originalPolicy,'lib/auth-routes.ts'],outdir:folder,bundle:true,platform:'node',format:'esm',plugins:[mock],outExtension:{'.js':'.mjs'}});
const {passwordMeetsPolicy}=await import(join(folder,'password-policy.mjs'));
const {authRoute}=await import(join(folder,'auth-routes.mjs'));
let statements=[];
const e={DB:{prepare(sql){const args=[];return{bind(...values){args.push(...values);return this;},async first(){return null;},async run(){statements.push({sql,args});return {meta:{changes:1}};}}}}};
function request(action,data={}){
 return new Request('https://site.example/api/auth/'+action,{method:'POST',headers:{'Content-Type':'application/json','origin':'https://site.example'},body:JSON.stringify(data)});
}
function reset(){statements=[];providerCalls.length=0;globalThis.__authIdentity=null;globalThis.__providerAutoConfirm=false;}
test('eight-character policy requires upper lower digit and symbol',()=>{
 assert(passwordMeetsPolicy('Abcdef1!'));
 for(const password of ['Abcde1!','abcdefgh1!','ABCDEFGH1!','Abcdefgh!','Abcdefg12','abcdefgh1234','ABCdef1 ','Abcd1!'])assert.equal(passwordMeetsPolicy(password),false,password);
 assert(passwordMeetsPolicy('My Longer Password 4#'));
});
test('signup enforces new password policy on the server',async()=>{
 reset();
 let r=await authRoute(request('signup',{email:'person@example.test',password:'password1234',username:'tester',name:'Tester',phone:'+5516999999999',accept:true,adult:true}),e);
 assert.equal(r.status,400);
 assert.equal(providerCalls.length,0,'never send weak passwords to provider');
 r=await authRoute(request('signup',{email:'person@example.test',password:'Abcdef1!',username:'tester',name:'Tester',phone:'+5516999999999',accept:true,adult:true}),e);
 assert.equal(r.status,200);
 assert.equal(providerCalls[0].path,'/settings');
 assert.equal(providerCalls[1].path,'/signup');
});
test('disabled provider email confirmation fails before signup, without creating an unusable account',async()=>{
 reset();globalThis.__providerAutoConfirm=true;
 const r=await authRoute(request('signup',{email:'person@example.test',password:'Abcdef1!',username:'tester',name:'Tester',phone:'+5516999999999',accept:true,adult:true}),e);
 assert.equal(r.status,503);
 assert.equal(providerCalls.length,1);
 assert.equal(providerCalls[0].path,'/settings');
 assert(!providerCalls.some(call=>call.path==='/signup'));
 reset();
});
test('legacy account passwords remain accepted at login',async()=>{
 reset();
 const r=await authRoute(request('login',{email:'person@example.test',password:'legacy-password-no-symbol'}),e);
 assert.equal(r.status,200);
 assert.equal(providerCalls[0].path,'/token?grant_type=password');
});
test('changing password requires logged-in identity and old password',async()=>{
 reset();
 const data={currentPassword:'Current1!',newPassword:'NewPass2@'};
 assert.equal((await authRoute(request('change-password',data),e)).status,401);
 globalThis.__authIdentity={purpose:'login',user:{userId:testUserId,email:'person@example.test'},accessToken:'existing-token'};
 const wrong=await authRoute(request('change-password',{...data,currentPassword:'Wrong1!'}),e);
 assert.equal(wrong.status,401);
 assert.equal(providerCalls.filter(x=>x.method==='PUT').length,0);
 const weak=await authRoute(request('change-password',{...data,newPassword:'alllowercase123'}),e);
 assert.equal(weak.status,400);
 const same=await authRoute(request('change-password',{currentPassword:'Current1!',newPassword:'Current1!'}),e);
 assert.equal(same.status,400);
 const ok=await authRoute(request('change-password',data),e);
 assert.equal(ok.status,200);
 assert.equal(ok.headers.get('set-cookie'),'cleared-test-cookie');
 assert.equal(providerCalls.filter(x=>x.method==='PUT').length,1);
 assert.equal(providerCalls.find(x=>x.method==='PUT').token,'recent-token');
 assert(statements.some(x=>x.sql.includes('DELETE FROM auth_sessions')&&x.args[0]===testUserId));
});
after(async()=>{delete globalThis.__authIdentity;delete globalThis.__mockProvider;await rm(folder,{recursive:true,force:true});});
