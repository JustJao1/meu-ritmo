import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const route=readFileSync('lib/auth-routes.ts','utf8');
const server=readFileSync('lib/auth-server.ts','utf8');
const form=readFileSync('components/auth-form.tsx','utf8');
const template=readFileSync('supabase/templates/confirm-signup-otp.html','utf8');
const translations=readFileSync('components/language-selector.tsx','utf8');

test('signup confirmation email exposes Supabase OTP, not a verification link',()=>{
 assert.match(template,/\{\{\s*\.Token\s*\}\}/);
 assert.doesNotMatch(template,/\.ConfirmationURL|\.TokenHash/);
 assert.match(template,/Confirme seu e-mail/);
});

test('signup verification uses the provider signup OTP type, not email magic link',()=>{
 assert.match(route,/z\.enum\(\['signup','recovery'\]\)/);
 assert.match(route,/provider\(e,'\/verify',\{email:mail,token,type\}\)/);
});

test('resend uses signup-only action, rate limit and no user enumeration',()=>{
 assert.match(route,/action==='resend-signup'\?3:10/);
 assert.match(route,/provider\(e,'\/resend',\{type:'signup',email:mail\}\)/);
 assert.match(route,/if\(!r\.ok\)\{/);
 assert.match(route,/auth_resend_signup_rejected/);
 assert.match(route,/Solicitação de reenvio aceita/);
 assert.match(form,/fetch\('\/api\/auth\/resend-signup'/);
 assert.match(form,/Reenviar código de confirmação/);
 assert.match(form,/onChange=\{mode==='verify'\?e=>setPendingEmail/);
});

test('pending usernames redirect their original owner to verification rather than being silently freed',()=>{
 assert.match(route,/SELECT 1 FROM auth_pending_profiles WHERE username=\?/);
 assert.match(route,/pendingVerification:true/);
 assert.match(form,/Confirmar meu cadastro anterior/);
 assert.match(form,/v\.pendingVerification===true/);
});

test('pending signup requires a valid code rather than password login or provider link',()=>{
 assert.match(route,/if\(await hasPendingVerification\(e,sessionUser\.userId\)\)/);
 assert.doesNotMatch(route,/action==='login'[^\n]*await finishProfile/);
 assert.match(route,/if\(requiresEmailConfirmation\)/);
 assert.match(server,/if\(purpose==='login'&&await hasPendingVerification/);
 assert.match(server,/if\(row\.purpose==='login'&&await hasPendingVerification/);
 assert.match(route,/if\(type==='signup'\)await finishProfile/);
 assert.match(form,/\(mode==='signup'\|\|mode==='login'\)&&pendingSignup/);
});
test('username collision still leaves account pending until OTP and sends user through onboarding',()=>{
 assert.ok(route.includes("(requiresEmailConfirmation?'pending_':'usuario_')+id.replaceAll('-','').slice(0,16)"));
 assert.ok(route.includes("bind(id,generatedUsername,p.name,now,now).run()"));
 assert.ok(server.includes("if(p.username==='pending_'+u.userId.replaceAll('-','').slice(0,16))"));
});
test('new user-facing strings have translations for English and Spanish',()=>{
 for(const key of [
  'Digite o código de seis dígitos enviado ao seu e-mail. Se não recebeu, você pode solicitar outro abaixo.',
  'Reenviar código de confirmação',
  'Informe seu e-mail para reenviar o código.',
  'Não foi possível reenviar o código.',
  'Confirmar meu cadastro anterior',
  'Solicitação de reenvio aceita. Confira a caixa de entrada e o spam.'
 ]){
   assert.ok(translations.includes(JSON.stringify(key)),key);
 }
});

test('signup checks Supabase public confirmation policy before creating an account',()=>{
 const settings=route.indexOf("const settingsResponse=await provider(e,'/settings')");
 const signup=route.indexOf("const r=await provider(e,'/signup'");
 assert.ok(settings>0&&signup>settings,'Provider settings must be checked before signup');
 assert.match(route,/requiresEmailConfirmation=settings\.mailer_autoconfirm===false/);
 assert.match(route,/emailConfirmationRequired:false/);
 assert.match(route,/emailConfirmationRequired:true/);
 assert.match(route,/if\(!settingsResponse\.ok\)return reply/);
});
