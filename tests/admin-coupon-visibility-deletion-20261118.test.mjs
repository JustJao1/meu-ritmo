import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {build} from 'esbuild';

const folder=mkdtempSync(join(tmpdir(),'meu-ritmo-coupon-admin-'));
const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort()){
 const sql=readFileSync(join('drizzle',file),'utf8').replace(/--> statement-breakpoint/g,'');
 db.exec(sql);
}

const DB={
 prepare(sql){
  let values=[];
  return {
   bind(...args){values=args;return this},
   async all(){return {results:db.prepare(sql).all(...values)}},
   async first(){return db.prepare(sql).get(...values)||null},
   async run(){const v=db.prepare(sql).run(...values);return {meta:{changes:v.changes}}}
  };
 },
 async batch(statements){
  const results=[];for(const statement of statements)results.push(await statement.run());return results;
 }
};
globalThis.__adminCouponEnv={DB};
globalThis.__adminCouponRole='owner';
const plugin={name:'mocks',setup(ctx){
 ctx.onResolve({filter:/^cloudflare:workers$/},()=>({namespace:'fixture',path:'workers'}));
 ctx.onResolve({filter:/\/session$/},()=>({namespace:'fixture',path:'session'}));
 ctx.onResolve({filter:/\/admin-access$/},()=>({namespace:'fixture',path:'access'}));
 ctx.onResolve({filter:/\/asaas$/},()=>({namespace:'fixture',path:'asaas'}));
 ctx.onLoad({filter:/.*/,namespace:'fixture'},args=>{
  if(args.path==='workers')return{loader:'js',contents:'export const env=globalThis.__adminCouponEnv'};
  if(args.path==='session')return{loader:'js',contents:'export async function getUser(){return {userId:"owner",email:"owner@mr.test"}}'};
  if(args.path==='asaas')return{loader:'js',contents:'export function asaasConfig(){return {mode:"production",enabled:true}}'};
  return{loader:'js',contents:`export const appRole=async()=>globalThis.__adminCouponRole;
export const sameOrigin=()=>true;
export function auditStatement(user,action,target,details){
 return globalThis.__adminCouponEnv.DB.prepare("INSERT INTO app_audit(id,actor_id,actor_email,action,target,details,created_at) VALUES (?,?,?,?,?,?,?)")
 .bind(crypto.randomUUID(),user.userId,user.email,action,target,JSON.stringify(details),Math.floor(Date.now()/1000));
}`};
 });
}};
await build({entryPoints:['app/api/admin/discounts/route.ts'],outfile:join(folder,'discounts.mjs'),bundle:true,format:'esm',platform:'node',plugins:[plugin]});
const api=await import(join(folder,'discounts.mjs'));
const until=Math.floor(Date.now()/1000)+86400;
for(let i=0;i<35;i++){
 const code='MRCOUPON'+String(i).padStart(3,'0');
 db.prepare('INSERT INTO discount_codes(id,code,label,plan,kind,value,expires_at,max_uses,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
  .run(crypto.randomUUID(),code,'Campanha '+i,'all','percent',10,until,100,until-3600+i);
}
const get=async(q='')=>{
 const r=await api.GET(new Request('https://meuritmo.net/api/admin/discounts'+q));
 return {status:r.status,data:await r.json()};
};
const post=async(body)=>{
 const r=await api.POST(new Request('https://meuritmo.net/api/admin/discounts',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://meuritmo.net'},body:JSON.stringify(body)}));
 return {status:r.status,data:await r.json()};
};

test('cupons existentes aparecem com paginação, busca por código e total real',async()=>{
 const first=await get();
 assert.equal(first.status,200);
 assert.equal(first.data.total,35);
 assert.equal(first.data.discounts.length,30);
 assert.equal(first.data.hasMore,true);
 const second=await get('?page=1');
 assert.equal(second.data.discounts.length,5);
 assert.equal(second.data.hasMore,false);
 const search=await get('?q=MRCOUPON004');
 assert.equal(search.data.discounts.length,1);
 assert.equal(search.data.discounts[0].code,'MRCOUPON004');
 assert.equal(search.data.total,1);
});

test('excluir bloqueia compra e oculta cupom sem apagar usos e auditoria',async()=>{
 const d=db.prepare('SELECT id,code FROM discount_codes WHERE code=?').get('MRCOUPON004');
 db.prepare('INSERT INTO asaas_coupon_uses(coupon_id,user_id,order_id,used_at) VALUES (?,?,?,?)')
  .run(d.id,'buyer','order-1',until-120);
 const deleted=await post({action:'delete',id:d.id});
 assert.equal(deleted.status,200);
 assert.match(deleted.data.message,/Compras anteriores foram preservadas/);
 const state=db.prepare('SELECT enabled,archived_at FROM discount_codes WHERE id=?').get(d.id);
 assert.equal(state.enabled,0);
 assert.equal(typeof state.archived_at,'number');
 assert.equal(db.prepare('SELECT count(*) AS n FROM asaas_coupon_uses WHERE coupon_id=?').get(d.id).n,1);
 assert.equal((await get('?q=MRCOUPON004')).data.total,0);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM app_audit WHERE action='discount_deleted'").get().n,1);
 const attempt=await post({action:'toggle',id:d.id,enabled:true});
 assert.equal(attempt.status,404);
 const duplicate=await post({action:'create',code:'MRCOUPON004',label:'Another test',plan:'plus',kind:'percent',value:10,expiresAt:until,maxUses:2});
 assert.equal(duplicate.status,409);
});

test('somente proprietário pode excluir; administrador pode desativar',async()=>{
 const d=db.prepare('SELECT id FROM discount_codes WHERE code=?').get('MRCOUPON003');
 globalThis.__adminCouponRole='admin';
 const removed=await post({action:'delete',id:d.id});
 assert.equal(removed.status,403);
 assert.equal(db.prepare('SELECT enabled FROM discount_codes WHERE id=?').get(d.id).enabled,1);
 const disabled=await post({action:'toggle',id:d.id,enabled:false});
 assert.equal(disabled.status,200);
 globalThis.__adminCouponRole='owner';
});

test('a interface oferece lista independente e exclusão confirmada para os dois tipos',()=>{
 const panel=readFileSync('components/admin-panel.tsx','utf8');
 const extras=readFileSync('components/admin-extras.tsx','utf8');
 const promoRoute=readFileSync('app/api/admin/route.ts','utf8');
 const redeem=readFileSync('app/api/promotions/redeem/route.ts','utf8');
 assert(panel.includes("['Descontos','Moderação','Lançamento'].includes(tab)?<AdminExtras"));
 assert(panel.includes("action:'delete_promo'"));
 assert(panel.includes("intent:'danger'"));
 assert(extras.includes("action:'delete'"));
 assert(extras.includes("className=\"admin-discount-search\""));
 assert(extras.includes("className=\"admin-discount-pagination\""));
 assert(promoRoute.includes("promo_deleted"));
 assert(redeem.includes("p.archived_at IS NULL"));
});

after(()=>{db.close();rmSync(folder,{recursive:true,force:true});delete globalThis.__adminCouponEnv;delete globalThis.__adminCouponRole});
