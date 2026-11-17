import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('shared-space inbox and visible indicators are present on desktop and mobile',()=>{
 const main=src('app/ritmo.tsx'),shared=src('components/shared-spaces.tsx'),css=src('app/shared-space-notifications.css');
 for(const label of ['shared-workspace-counter','shared-top-space-counter','shared-bell-counter','shared-activity-toast','SharedSpaceInbox'])assert(main.includes(label),label);
 assert.match(shared,/shared-entry-unread/);assert.match(shared,/onReadSpace\?\.\(id\)/);
 assert.match(css,/@media\(max-width:650px\)/);
});
test('polling does not require push permission and does not clear unread on errors',()=>{
 const hook=src('hooks/use-shared-space-notifications.ts');
 assert.match(hook,/setInterval\(\(\)=>void refresh\(\),15000\)/);
 assert.match(hook,/visibilitychange/);
 assert.match(hook,/response\.ok/);
 assert.match(hook,/knownIds\.current/);
 assert.doesNotMatch(hook,/requestPermission/);
});
