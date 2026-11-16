import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('the billing filter chevron is inset from the border, theme aware and never intercepts clicks',()=>{
 const css=readFileSync('app/admin-billing-layout.css','utf8');
 const label=css.match(/\.adminshell \.adminbilling \.billing-filter\{([^}]+)\}/)?.[1]||'';
 const select=css.match(/\.adminshell \.adminbilling \.billing-filter select\{([^}]+)\}/)?.[1]||'';
 const chevron=css.match(/\.adminshell \.adminbilling \.billing-filter::after\{([^}]+)\}/)?.[1]||'';
 assert.match(label,/position:relative/);
 assert.match(select,/appearance:none/);
 assert.match(select,/padding:11px 48px 11px 14px/);
 assert.match(chevron,/right:20px/);
 assert.match(chevron,/pointer-events:none/);
 assert.match(chevron,/border-right:2px solid var\(--ink\)/);
 assert.match(chevron,/border-bottom:2px solid var\(--ink\)/);
});
