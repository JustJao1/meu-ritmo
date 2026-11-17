import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync('scripts/asaas-production-ledger-audit.mjs','utf8');
const workflow=readFileSync('.github/workflows/asaas-production-ledger-audit.yml','utf8');
test('o monitor financeiro apenas consulta contagens do banco comercial e protege segredos',()=>{
 assert.match(script,/ASAAS_MODE!=='production'/);
 assert.match(script,/e\.CLOUDFLARE_D1_DATABASE_ID\.toLowerCase\(\)===e\.SANDBOX_D1_DATABASE_ID\.toLowerCase\(\)/);
 assert.match(script,/SELECT status,COUNT\(\*\) AS total FROM asaas_orders/);
 assert.match(script,/SELECT status,COUNT\(\*\) AS total FROM asaas_hosted_pix_checkouts/);
 assert.match(script,/console\.warn/);
 assert.doesNotMatch(script,/UPDATE asaas_|DELETE FROM asaas_|INSERT INTO asaas_/);
 assert.doesNotMatch(script,/cpfCnpj|email|user_id\s*,\s*customer_id/);
 assert.match(workflow,/environment: production/);
 assert.match(workflow,/workflow_dispatch:/);
});
