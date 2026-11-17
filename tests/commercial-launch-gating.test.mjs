import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('launch removes preview banner based on live status and keeps the site owner Pro',()=>{
 const app=readFileSync('app/ritmo.tsx','utf8');
 const access=readFileSync('lib/entitlements.ts','utf8');
 assert.match(app,/showEarlyAccess&&purchaseStatus\?\.earlyAccess!==false/);
 assert.match(app,/fetch\('\/api\/billing\/status',\{cache:'no-store'\}\)/);
 assert.match(access,/ADMIN_OWNER_USER_ID/);
 assert.match(access,/source:'owner'/);
});
