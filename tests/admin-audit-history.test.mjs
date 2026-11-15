import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const folder=await mkdtemp(join(tmpdir(),'meu-ritmo-audit-'));
await build({entryPoints:['lib/admin-audit.ts'],outfile:join(folder,'audit.mjs'),bundle:true,platform:'node',format:'esm'});
const {auditDefinition,auditDetails,auditTarget,auditDetailFields}=await import(join(folder,'audit.mjs'));
const read=path=>readFile(path,'utf8');

test('administrative action codes are presented as understandable descriptions',()=>{
 const examples={
  report_resolved:['Denúncia analisada','community'],
  legal_updated:['Dados do responsável atualizados','settings'],
  social_removed:['Conteúdo removido da comunidade','community'],
  promo_created:['Código promocional criado','codes'],
  promo_redeemed:['Código promocional resgatado','codes'],
  social_suspended:['Perfil suspenso da comunidade','community'],
  admin_added:['Administrador adicionado','access'],
  grant_revoked:['Acesso revogado','access'],
  discount_created:['Cupom de desconto criado','codes'],
  privacy_resolved:['Solicitação de privacidade concluída','settings']
 };
 for(const [action,[label,group]] of Object.entries(examples)){
  assert.deepEqual(auditDefinition(action),{label,group},action);
 }
 assert.deepEqual(auditDefinition('some_future_action'),{label:'Outra alteração registrada',group:'other'});
});
test('technical references are shortened for reading but not removed from audit data',()=>{
 const uuid='5c392d48-1245-4212-97b1-13204c8427b3';
 assert.deepEqual(auditTarget(uuid,'report_resolved'),{text:'Registro 5C392D48',isTechnical:true});
 assert.deepEqual(auditTarget('service','legal_updated'),{text:'Identificação do serviço',isTechnical:false});
 assert.deepEqual(auditTarget('RITMO-J4ZGXZY2ZB','promo_redeemed'),{text:'RITMO-J4ZGXZY2ZB',isTechnical:false});
});
test('audit details tolerate malformed legacy data and preserve known fields',()=>{
 for(const value of ['',null,'null','[]','{"broken"',42])assert.deepEqual(auditDetails(value),{});
 const parsed=auditDetails('{"reason":"Perfil denunciado","plan":"pro","days":365,"unknown":{"private":"ignored"}}');
 assert.equal(parsed.reason,'Perfil denunciado');
 assert.deepEqual(auditDetailFields(parsed).map(field=>field.key),['reason','plan','days']);
});
test('audit history stays read-only, translated, filterable and theme-aware',async()=>{
 const component=await read('components/admin-audit-history.tsx');
 const panel=await read('components/admin-panel.tsx');
 const css=await read('app/admin-audit-history.css');
 const translations=await read('components/language-selector.tsx');
 assert.match(panel,/<AdminAuditHistory entries=\{data\.audit\}/);
 assert.doesNotMatch(panel,/data\.audit\.map\(/);
 assert.match(component,/filter!==.*all.*entry\.definition\.group/);
 assert.match(component,/entry\.actor_email/);
 assert.match(component,/<details className="mr-audit-detail">/);
 assert.match(component,/timeZone:'America\/Sao_Paulo'/);
 assert.match(css,/--audit-border/);
 assert.match(css,/var\(--paper\)/);
 assert.match(css,/@media\(max-width:700px\)/);
 for(const key of ['Histórico de atividades','Denúncia analisada','Conteúdo removido da comunidade','Ver informações do registro'])
  assert(translations.includes(JSON.stringify(key)+':['),key+' must be translated');
});
after(async()=>{await rm(folder,{recursive:true,force:true});});
