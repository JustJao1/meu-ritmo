import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync('app/shared-spaces.css','utf8');
const ui=readFileSync('components/shared-spaces.tsx','utf8');
test('personal and first shared space have a visible gap at all screen sizes',()=>{
 assert.match(ui,/className="shared-personal"/);
 assert.match(ui,/shared-space-entry/);
 assert.match(css,/\.sharedspaces \.shared-list > \.shared-personal \+ \.shared-space-entry\s*\{\s*margin-block-start:16px/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/margin-block-start:12px/);
});
test('additional shared spaces keep breathing room without fixed colors',()=>{
 assert.match(css,/\.sharedspaces \.shared-list > \.shared-space-entry \+ \.shared-space-entry\s*\{/);
 assert.match(css,/background:color-mix\(in srgb,var\(--paper\)/);
});
