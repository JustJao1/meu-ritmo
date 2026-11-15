import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('components/auth-form.tsx','utf8');

test('confirmation email restores cached address only when verification page is entered',()=>{
 assert.match(source,/if\(mode!=='verify'\)return;[\s\S]*?sessionStorage\.getItem\('mr-pending-email'\)[\s\S]*?\},\[mode\]\);/);
 assert.doesNotMatch(source,/setPendingEmail\(sessionStorage\.getItem\('mr-pending-email'\)\|\|''\);\}catch\{\}[\s\S]*?\},\[mode,t\]\)/);
});

test('email input stays editable, and resend uses current typed address',()=>{
 assert.match(source,/value=\{mode==='verify'\?pendingEmail:undefined\}/);
 assert.match(source,/onChange=\{mode==='verify'\?e=>setPendingEmail\(e\.target\.value\):undefined\}/);
 assert.match(source,/body:JSON\.stringify\(\{email:pendingEmail\}\)/);
});
