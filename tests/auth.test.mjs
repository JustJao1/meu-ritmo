import {test,after} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {build} from 'esbuild';import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const folder=await mkdtemp(join(tmpdir(),'ritmo-auth-'));await build({entryPoints:['lib/auth-server.ts','lib/auth-context.ts','lib/return-path.ts'],outdir:folder,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'}});const a=await import(join(folder,'auth-server.mjs')),c=await import(join(folder,'auth-context.mjs')),p=await import(join(folder,'return-path.mjs'));const db=new DatabaseSync(':memory:');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+f,'utf8'));const e={SUPABASE_URL:'https://auth.example.test',SUPABASE_PUBLISHABLE_KEY:'public-test',SESSION_ENCRYPTION_KEY:Buffer.alloc(32,42).toString('base64url'),DB:{prepare(sql){let args=[];return {bind(...v){args=v;return this},async run(){return db.prepare(sql).run(...args)},async first(){return db.prepare(sql).get(...args)}}}}};const id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',user={id,email:'test@example.test',email_confirmed_at:new Date().toISOString(),is_anonymous:false,user_metadata:{role:'owner'}};const original=globalThis.fetch;
test('cookie opaco, credenciais cifradas e validação de usuário no provedor',async()=>{globalThis.fetch=async()=>Response.json(user);const cookie=await a.issueSession(e,{access_token:'private-access',refresh_token:'private-refresh'});assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);assert(!cookie.includes('private-'));const row=db.prepare('SELECT * FROM auth_sessions').get();assert(!row.tokens.includes('private-'));const session=await a.resolveSession(e,new Request('https://site.test',{headers:{cookie:cookie.split(';')[0]}}));assert.equal(session.user.userId,id);assert.equal(session.user.role,undefined);assert.equal(session.accessToken,'private-access');await a.revoke(e,session);assert.equal(await a.resolveSession(e,new Request('https://site.test',{headers:{cookie:cookie.split(';')[0]}})),null)});
test('cabeçalhos de identidade e cookies forjados não geram sessão',async()=>{for(const headers of [{'oai-authenticated-user-id':id,'oai-authenticated-user-email':user.email},{cookie:a.cookieName+'=forged'}])assert.equal(await a.resolveSession(e,new Request('https://site.test',{headers})),null)});
test('cifra adulterada e e-mail não confirmado são rejeitados',async()=>{const sealed=await a.seal(e,{secret:'keep'});assert.deepEqual(await a.unseal(e,sealed),{secret:'keep'});await assert.rejects(()=>a.unseal(e,sealed.slice(0,-4)+'AAAA'));assert.throws(()=>a.verifiedUser({...user,email_confirmed_at:null}));assert.throws(()=>a.verifiedUser({...user,is_anonymous:true}))});
test('limite de login persiste no banco e separa ações',async()=>{const req=new Request('https://site.test',{headers:{'cf-connecting-ip':'192.0.2.1'}});assert(await a.authRate(e,req,'login','a@test.example',2));assert(await a.authRate(e,req,'login','a@test.example',2));assert(!await a.authRate(e,req,'login','a@test.example',2));assert(await a.authRate(e,req,'recover','a@test.example',2))});
test('identidade não vaza entre solicitações concorrentes e redirecionamentos são locais',async()=>{await Promise.all(['one','two'].map(hash=>c.withIdentity({hash},async()=>{await new Promise(r=>setTimeout(r,5));assert.equal(c.identity().hash,hash)})));assert.equal(c.identity(),null);for(const path of ['https://bad.test','//bad.test','/\\bad.test','/api/auth/logout'])assert.equal(p.safeReturnPath(path),'/app');assert.equal(p.safeReturnPath('/app?area=Hoje'),'/app?area=Hoje')});

test('expired session refreshes once across concurrent hard reload requests',async()=>{
 let expires=false,refreshCalls=0;
 globalThis.fetch=async(input,init)=>{
  const url=String(input),bearer=new Headers(init?.headers).get('Authorization');
  if(url.includes('/token?grant_type=refresh_token')){
   refreshCalls++;
   assert.equal(JSON.parse(String(init?.body)).refresh_token,'rotating-token-1');
   await new Promise(resolve=>setTimeout(resolve,80));
   return Response.json({access_token:'renewed-access',refresh_token:'rotating-token-2',user});
  }
  if(url.endsWith('/user')&&expires&&bearer==='Bearer initial-access')return Response.json({msg:'JWT expired'},{status:401});
  return Response.json(user);
 };
 const cookie=await a.issueSession(e,{access_token:'initial-access',refresh_token:'rotating-token-1'});
 expires=true;
 const req=new Request('https://site.test/app',{headers:{cookie:cookie.split(';')[0]}});
 const sessions=await Promise.all(Array.from({length:6},()=>a.resolveSession(e,req)));
 assert.equal(refreshCalls,1,'only one request must rotate the refresh token');
 for(const session of sessions){assert.equal(session?.user.userId,id);assert.equal(session?.accessToken,'renewed-access');}
 const stored=db.prepare('SELECT tokens,refresh_lock_owner,refresh_lock_until FROM auth_sessions WHERE id_hash=?').get(await a.hash(cookie.split(';')[0].split('=')[1]));
 assert.equal(stored.refresh_lock_owner,null);
 assert.equal(stored.refresh_lock_until,0);
 assert.equal((await a.unseal(e,stored.tokens)).refreshToken,'rotating-token-2');
 assert.equal((await a.resolveSession(e,req))?.user.userId,id,'hard reload must keep the same login');
});
test('temporary auth provider failure preserves stored cookie session',async()=>{
 let fail=false;
 globalThis.fetch=async(input,init)=>{
  if(fail&&String(input).endsWith('/user'))return Response.json({error:'busy'},{status:503});
  return Response.json(user);
 };
 const cookie=await a.issueSession(e,{access_token:'stable-access',refresh_token:'stable-refresh'});
 const req=new Request('https://site.test/app',{headers:{cookie:cookie.split(';')[0]}});
 fail=true;
 await assert.rejects(()=>a.resolveSession(e,req),/auth_provider_temporarily_unavailable/);
 fail=false;
 assert.equal((await a.resolveSession(e,req))?.user.userId,id,'temporary outage must not log the user out');
});

after(async()=>{globalThis.fetch=original;db.close();await rm(folder,{recursive:true,force:true})});
