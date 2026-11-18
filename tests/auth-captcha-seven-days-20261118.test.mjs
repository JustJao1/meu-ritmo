import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('login extra check only after seven days without sessions',()=>{
 const code=read('lib/auth-security.ts');
 assert.match(code,/current-contact\.disconnected_at>=604800/);
 assert.match(code,/current-last\.last>=604800/);
 assert.doesNotMatch(code,/>=86400/);
 assert.match(read('components/auth-form.tsx'),/Após 7 dias desconectado/);
 assert.match(read('components/account-security.tsx'),/Após 7 dias desconectado/);
});
test('Turnstile is validated on the server and protects signup and recovery',()=>{
 const code=read('lib/auth-captcha.ts'),route=read('lib/auth-routes.ts'),form=read('components/auth-form.tsx');
 assert.match(code,/challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
 assert.match(code,/result\.success!==true\|\|result\.hostname!==new URL\(request\.url\)\.hostname/);
 assert.match(route,/action==='signup'\|\|action==='recover'/);
 assert.match(route,/verifyAuthCaptcha\(e,req,b\.captchaToken\)/);
 assert.match(form,/TurnstileCaptcha/);
 assert.match(form,/captchaToken/);
});
test('signups have no daily quota and can finish without an email when provider allows it',()=>{
 const route=read('lib/auth-routes.ts');
 assert.match(route,/requiresEmailConfirmation=settings\.mailer_autoconfirm===false/);
 assert.match(route,/await finishProfile\(e,verifiedUser\(v\.user\)\)/);
 assert.match(route,/emailConfirmationRequired:false/);
 assert.doesNotMatch(route,/signupDailyLimit|signup_daily_limit/);
 assert.match(route,/action==='resend-signup'\?3:10/);
});

test('new signups open the app without email confirmation and login omits legacy signup link',()=>{
 const form=read('components/auth-form.tsx'),routes=read('lib/auth-routes.ts');
 assert.match(form,/if\(v\.emailConfirmationRequired===false\)/);
 assert.match(form,/location\.href='\/app'/);
 assert.doesNotMatch(form,/href="\/confirmar-email">\{t\('Ainda não confirmei meu e-mail'\)\}/);
 assert.match(form,/\(mode==='signup'\|\|mode==='login'\)&&pendingSignup/);
 assert.match(routes,/emailConfirmationRequired:false/);
 assert.match(routes,/Confira seu e-mail e senha\./);
});
