import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../lib/plans.ts',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
const pattern=/id:'([^']+)',name:'([^']+)',description:'[^']+',paper:'(#[0-9a-f]+)',side:'(#[0-9a-f]+)',banner:'(#[0-9a-f]+)',ink:'(#[0-9a-f]+)',accent:'(#[0-9a-f]+)'/gi;
const themes=[...source.matchAll(pattern)].map(([,id,name,paper,side,banner,ink,accent])=>({id,name,paper,side,banner,ink,accent}));
function luminance(hex){const [r,g,b]=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*r+0.7152*g+0.0722*b;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
test('all 22 appearance themes have unique identifiers and readable semantic surfaces',()=>{
 assert.equal(themes.length,22,'Theme count must stay at 22');
 assert.equal(new Set(themes.map(t=>t.id)).size,22,'Duplicate theme id');
 for(const t of themes){
  for(const key of ['paper','side','banner']) assert.ok(contrast(t.ink,t[key])>=7,`${t.id}: ink on ${key} falls below WCAG AAA normal-text contrast`);
 }
});
test('all 16 dark themes are included in the dark contrast rules',()=>{
 const dark=themes.filter(t=>luminance(t.paper)<0.1);
 assert.equal(dark.length,16,'Unexpected dark theme count');
 for(const t of dark)assert.ok(css.includes(`[data-theme="${t.id}"]`),`Missing dark-theme selector: ${t.id}`);
});
test('the UI binds selected palette to the CSS variables',()=>{
 const app=readFileSync(new URL('../app/ritmo.tsx',import.meta.url),'utf8');
 for(const variable of ['--paper','--ink','--accent','--theme-side','--theme-banner']) assert.ok(app.includes(`setProperty('${variable}'`),`Missing palette binding: ${variable}`);
});
