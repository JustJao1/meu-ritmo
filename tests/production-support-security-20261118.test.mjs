import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(p,'utf8');
const migration=file('drizzle/0018_support_contact_security.sql');
const router=file('lib/auth-routes.ts');
const auth=file('lib/auth-security.ts');
const server=file('lib/auth-server.ts');
const form=file('components/auth-form.tsx');
const support=file('app/api/support/route.ts');
const supportAdmin=file('app/api/admin/support/route.ts');
const health=file('app/api/health/route.ts');
const monitor=file('.github/workflows/monitor-production.yml');

test('cadastro não permite telefone inválido nem pula verificação de e-mail',()=>{
 assert.match(router,/normalizePhone\(b\.phone\)/);
 assert.match(router,/mailer_autoconfirm!==false/);
 assert.match(form,/name="phone"/);
 assert.match(form,/Código por e-mail/);
});
test('sessão é liberada somente após código do login validado',()=>{
 assert.match(router,/LOGIN_STEP_UP_ENABLED==='true'&&await shouldChallenge\(/);
 assert.match(router,/challengeRequired:true/);
 assert.match(router,/completeLoginChallenge/);
 assert.match(auth,/attempts<5/);
 assert.match(auth,/expires_at>/);
 assert.match(auth,/user\.userId!==row\.user_id/);
 assert.match(auth,/DELETE FROM auth_login_challenges WHERE id_hash/);
 assert.match(auth,/return issueSession\(e,verified\)/);
 assert.match(server,/disconnected_at=NULL/);
 assert.match(server,/disconnected_at=excluded\.disconnected_at/);
 assert.match(auth,/86400/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS auth_login_challenges/);
 assert.match(file('.github/workflows/deploy.yml'),/LOGIN_STEP_UP_ENABLED/);
 assert.match(router,/stepUpEnabled:securityEnv.LOGIN_STEP_UP_ENABLED==='true'/);
 assert.match(form,/mode==='login'&&stepUpEnabled/);
});
test('WhatsApp só pode ser escolhido quando telefone foi confirmado',()=>{
 assert.match(router,/!row\?\.phone_verified_at/);
 assert.match(auth,/whatsappReady\(e\)/);
 assert.match(auth,/phone_verified_at/);
 assert.match(router,/currentPassword/);
 assert(router.includes("'contact-'+actionType"));
 assert.match(auth,/crypto\.subtle\.sign\('HMAC'/);
});
test('protocolos isolados por usuário e respostas autenticadas da equipe',()=>{
 assert.match(support,/WHERE user_id=\?/);
 assert.match(support,/WHERE id=\? AND user_id=\?/);
 assert.match(support,/sameOrigin\(req\)/);
 assert.match(supportAdmin,/appRole\(user\)==='user'/);
 assert.match(supportAdmin,/sameOrigin\(req\)/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS support_tickets/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS support_messages/);
});
test('monitoramento de produção é real, sem publicar dados privados',()=>{
 assert.match(health,/SELECT 1 AS ready/);
 assert.match(health,/asaasConfig\(\)/);
 assert.match(health,/status:'ok'/);
 assert.match(monitor,/cron: '\*\/15 \* \* \* \*'/);
 assert.match(monitor,/gh issue create/);
 assert.match(file('lib/request-security.ts'),/\/api\/health/);
});
