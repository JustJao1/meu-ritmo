import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';

const folder=await mkdtemp(join(tmpdir(),'mr-final-review-'));
await build({
  entryPoints:['lib/daily-motivation.ts','lib/legal-settings.ts'],
  outdir:folder,bundle:true,format:'esm',platform:'node',
  outExtension:{'.js':'.mjs'}
});
const {dailyMotivation}=await import(join(folder,'daily-motivation.mjs'));
const {parseLegalSettings}=await import(join(folder,'legal-settings.mjs'));
const file=p=>readFileSync(p,'utf8');

test('daily message remains stable within each day and unique for 730 consecutive days',()=>{
  for(const locale of ['pt-BR','en','es']){
    const messages=[];
    for(let d=0;d<730;d++){
      const date=new Date(Date.UTC(2026,10,15+d)).toISOString().slice(0,10);
      const message=dailyMotivation(date,locale);
      assert(message.length>45);
      assert.equal(message,dailyMotivation(date,locale));
      messages.push(message);
    }
    assert.equal(new Set(messages).size,messages.length,locale);
  }
  assert.equal(dailyMotivation('2026-02-30','pt-BR'),'');
});

test('legal identification fails closed on malformed, missing and invalid supplier data',()=>{
  const legal={name:'Empresa de Testes Ltda',taxId:'529.982.247-25',address:'Rua Exemplo, 100, São Paulo',email:'contato@example.test'};
  assert.deepEqual(parseLegalSettings(JSON.stringify(legal)),{...legal,email:'contato@example.test'});
  for(const v of [null,'{',JSON.stringify({...legal,taxId:'11111111111'}),JSON.stringify({...legal,email:'invalido'}),JSON.stringify({...legal,name:'a'})])
    assert.equal(parseLegalSettings(v),null);
});

test('checkout requires the policy consent, identifies the supplier and records the agreed conditions',()=>{
  const checkout=file('app/api/billing/checkout/route.ts');
  const migration=file('drizzle/0011_asaas_consents.sql');
  const app=file('app/ritmo.tsx');
  assert.match(checkout,/acceptTerms:z\.literal\(true\)/);
  assert.match(checkout,/acceptRefundPolicy:z\.literal\(true\)/);
  assert.match(checkout,/parseLegalSettings\(legalRecord\?\.value\)/);
  assert.match(checkout,/asaas_order_consents/);
  assert.match(migration,/policy_version/);
  assert.match(migration,/renewal_price_cents/);
  assert.match(app,/href="\/reembolso"/);
  assert.match(app,/acceptRefundPolicy:purchaseRefund/);
  assert.match(app,/priceQuote\.plan!==requestedPlan/);
  assert.match(app,/setPurchaseRefund\(false\)/);
});

test('public policies describe the actual Asaas flow and protect mandatory consumer rights',()=>{
  const legal=file('components/legal-page.tsx');
  assert.doesNotMatch(legal,/Stripe/);
  assert.match(legal,/Asaas/);
  assert.match(legal,/sete dias/);
  assert.match(legal,/protocolo/);
  assert.match(legal,/João Victor da Silva/);
  assert.match(legal,/parseLegalSettings/);
});

test('account creation lowercases usernames and password visibility covers the repeat field',()=>{
  const form=file('components/auth-form.tsx');
  assert.match(form,/setSignupUsername\(e\.target\.value\.toLowerCase\(\)\)/);
  assert.match(form,/name="username"[\s\S]*?value=\{signupUsername\}/);
  assert.match(form,/type=\{showPassword\?'text':'password'\} name="passwordConfirmation"/);
  assert.match(form,/Mostrar ambas as senhas/);
});

test('billing administration is owner-only and read-only',()=>{
  const route=file('app/api/admin/billing/route.ts');
  const panel=file('components/admin-panel.tsx');
  assert.match(route,/appRole\(user\)!=='owner'/);
  assert.doesNotMatch(route,/export async function POST/);
  assert.match(panel,/tab==='Cobranças'/);
});

after(async()=>{await rm(folder,{recursive:true,force:true})});
