import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const form=read('components/auth-form.tsx');
const settings=read('components/account-security.tsx');
const routes=read('lib/auth-routes.ts');
const security=read('lib/auth-security.ts');
const workflow=read('.github/workflows/deploy.yml');
const app=read('app/ritmo.tsx');
const locale=read('components/language-selector.tsx');

test('cadastro e login deixam claro que códigos só chegam por e-mail',()=>{
 assert(form.includes("Enviamos um código de seis dígitos para seu e-mail."));
 assert(form.includes("O telefone será mantido como dado de contato e não receberá códigos de segurança."));
 assert(form.includes("Após 7 dias desconectado, você confirmará o acesso com um código enviado por e-mail."));
 assert(!form.includes('<option value="whatsapp"'));
 assert(!form.includes("loginChannel"));
 assert(!form.includes("loginChallengeChannel"));
 assert(!form.includes("WhatsApp disponível após verificar seu número"));
});

test('área de segurança mantém telefone para contato, sem oferta de envio por WhatsApp',()=>{
 assert(settings.includes('O telefone fica salvo como dado de contato e não recebe códigos.'));
 assert(!settings.includes("operation:'send'"));
 assert(!settings.includes("operation:'verify'"));
 assert(!settings.includes('contact?.whatsappAvailable'));
 assert(app.includes('Telefone e segurança da conta'));
});

test('API exige canal email mesmo quando o cliente envia WhatsApp',()=>{
 assert(routes.includes("const channel='email' as const;"));
 assert(routes.includes("z.literal('email').parse(b.channel)"));
 assert(routes.includes("whatsapp:false"));
 assert(routes.includes("whatsappAvailable:false"));
 assert(security.includes("e.WHATSAPP_VERIFICATION_ENABLED==='true'"));
 assert(!workflow.includes('WHATSAPP_ACCESS_TOKEN:'));
 assert(!workflow.includes('WHATSAPP_PHONE_NUMBER_ID:'));
 assert(!workflow.includes('WHATSAPP_AUTH_TEMPLATE:'));
});

test('novas mensagens seguem traduzidas no idioma selecionado',()=>{
 for(const key of ['Telefone e segurança da conta','Telefone atualizado.','Após 7 dias desconectado, você confirmará o acesso com um código enviado por e-mail.']){
  assert(locale.includes(JSON.stringify(key)+':['),key);
 }
});
