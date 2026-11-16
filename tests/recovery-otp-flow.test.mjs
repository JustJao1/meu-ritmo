import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const route=readFileSync('lib/auth-routes.ts','utf8');
const form=readFileSync('components/auth-form.tsx','utf8');

test('OTP recovery exposes email only with recovery session, never as normal login',()=>{
 assert.match(route,/authenticated:s\?\.purpose==='login',recovery:s\?\.purpose==='recovery',email:s\?\.purpose==='recovery'\?s\.user\.email:undefined/);
 assert.match(route,/if\(action==='password'\)\{if\(!s\|\|s\.purpose!=='recovery'/);
});

test('password page accepts recovery session after code verification',()=>{
 assert.match(form,/if\(!access\|\|!refresh\|\|type!=='recovery'\)\{/);
 assert.match(form,/fetch\('\/api\/auth\/session',\{cache:'no-store'\}\)/);
 assert.match(form,/!r\.ok\|\|!v\.recovery\|\|!v\.email/);
 assert.match(form,/setRecoveryEmail\(v\.email\);setRecoveryReady\(true\)/);
 assert.match(form,/location\.href=verificationType==='recovery'\?'\/nova-senha':'\/app'/);
});

test('a recovery cookie cannot be used for normal authenticated app access',()=>{
 assert.match(route,/authenticated:s\?\.purpose==='login'/);
 assert.match(route,/s\.purpose!=='recovery'/);
});
