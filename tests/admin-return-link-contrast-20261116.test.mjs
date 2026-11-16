import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync('app/admin-theme-spacing.css','utf8');
const admin=readFileSync('components/admin-panel.tsx','utf8');
const plans=readFileSync('lib/plans.ts','utf8');
const palettes=[...plans.matchAll(/\{id:'([^']+)'[^}]*paper:'(#[0-9a-f]{6})'[^}]*ink:'(#[0-9a-f]{6})'/g)]
 .map(x=>({id:x[1],paper:x[2],ink:x[3]}));
const rgb=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));
const luminosity=x=>rgb(x).reduce((v,n,i)=>{
 const c=n/255;return v+(c<=.04045?c/12.92:((c+.055)/1.055)**2.4)*[.2126,.7152,.0722][i];
},0);
const ratio=(a,b)=>{const l=luminosity(a),r=luminosity(b);return (Math.max(l,r)+.05)/(Math.min(l,r)+.05)};
const mixed=(foreground,background)=>'#'+rgb(foreground)
 .map((v,i)=>Math.round(v*.09+rgb(background)[i]*.91).toString(16).padStart(2,'0')).join('');

test('admin return link uses a theme-safe background and text in normal and hover states',()=>{
 assert.match(admin,/<a href="\/app"><ArrowLeft size=\{15\}\/>\{tr\("Voltar ao meu espaço"\)\}<\/a>/);
 assert.match(css,/\.adminshell > \.adminnav > a:last-child:is\(:hover,:focus-visible\)\{/);
 assert.match(css,/background:color-mix\(in srgb,var\(--ink\) 9%,var\(--paper\)\)/);
 assert.match(css,/color:var\(--ink\)!important/);
 assert.match(css,/\.adminshell > \.adminnav > a:last-child :is\(svg,span\)/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/outline:2px solid var\(--theme-accent-readable,var\(--ink\)\)/);
});

test('return link remains readable over hover surface in every one of the 22 palettes',()=>{
 assert.equal(palettes.length,22);
 for(const p of palettes){
   const contrast=ratio(p.ink,mixed(p.ink,p.paper));
   assert.ok(contrast>=7,p.id+': '+contrast.toFixed(2));
 }
});
