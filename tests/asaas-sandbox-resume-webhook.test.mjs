import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync('scripts/asaas-sandbox-resume-webhook.mjs','utf8');
const workflow=readFileSync('.github/workflows/asaas-sandbox-resume-webhook.yml','utf8');
test('webhook reactivation only runs after successful isolated Sandbox deployment',()=>{
 assert.match(workflow,/workflow_run:/);
 assert.match(workflow,/conclusion == 'success'/);
 assert.match(workflow,/head_sha == github\.sha/);
 assert.match(workflow,/environment: sandbox/);
});
test('sandbox recovery verifies distinct databases and new review schema before changing webhook',()=>{
 assert.match(script,/e\.ASAAS_MODE!=='sandbox'/);
 assert.match(script,/\$aact_hmlg_/);
 assert.match(script,/PRODUCTION_D1_DATABASE_ID/);
 assert.match(script,/asaas_webhook_reviews/);
 assert.match(script,/validateD1\(\)/);
 assert.match(script,/interrupted:false/);
 assert.doesNotMatch(script,/api\.asaas\.com\/v3/);
 assert.doesNotMatch(script,/\/(customers|payments|subscriptions)'\s*,\s*'POST'/);
});
