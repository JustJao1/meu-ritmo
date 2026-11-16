import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
const appearance=read('lib/plans.ts');
const css=read('app/theme-calendar-alarm-contrast.css');
const oldCss=read('app/globals.css');
const layout=read('app/layout.tsx');
const alarm=read('components/alarm-player.tsx');
const extract=[...appearance.matchAll(/\{id:'([^']+)'[^}]*paper:'(#[a-f\d]{6})'[^}]*ink:'(#[a-f\d]{6})'/g)]
 .map(m=>({id:m[1],paper:m[2],ink:m[3]}));
const channels=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const luminosity=hex=>channels(hex).reduce((sum,v,i)=>{
 const n=v/255;
 return sum+(n<=.04045?n/12.92:((n+.055)/1.055)**2.4)*[.2126,.7152,.0722][i];
},0);
const contrast=(a,b)=>{const x=luminosity(a),y=luminosity(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const mix=(a,b,weight)=>'#'+channels(a).map((v,i)=>Math.round(v*weight+channels(b)[i]*(1-weight)).toString(16).padStart(2,'0')).join('');

test('all 22 palettes keep selected calendar dates and alarm actions above WCAG AAA text contrast',()=>{
 assert.equal(extract.length,22);
 for(const theme of extract){
  assert.ok(contrast(theme.ink,theme.paper)>=7,theme.id+' inverse control contrast');
  const raised=mix(theme.paper,theme.ink,.89);
  assert.ok(contrast(theme.ink,raised)>=7,theme.id+' selected calendar date contrast');
 }
});

test('today-calendar selectors include buttons and non-interactive div days',()=>{
 assert.match(oldCss,/\.monthgrid>div\.istoday\{\s*background:#f0f1ee;/);
 for(const selector of [
  '.appframe .calendarcolumns header.istoday',
  '.appframe .calendarcolumns .istoday header',
  '.appframe .monthgrid > button.istoday',
  '.appframe .monthgrid > div.istoday',
  '.appframe .monthgrid > div.istoday > span'
 ])assert.ok(css.includes(selector),selector+' missing');
 assert.match(css,/background:var\(--theme-raised,var\(--theme-banner,var\(--paper\)\)\)!important/);
 assert.match(css,/color:var\(--ink\)!important/);
 assert.match(css,/focus-within/);
});

test('alarm CTA and audio-enabling action have palette-based inverse contrast',()=>{
 for(const cls of ['alarmnotice-stop','soundnotice-action']){
  assert.ok(alarm.includes(cls),'Missing rendered control '+cls);
  assert.ok(css.includes('.'+cls),'Missing style '+cls);
 }
 assert.match(css,/background:var\(--ink\);\s*color:var\(--paper\);/);
 assert.match(css,/outline:2px solid var\(--theme-accent-readable,var\(--ink\)\)/);
 assert.match(css,/color:inherit;/);
});

test('theme fix is loaded after legacy CSS with reduced-motion support',()=>{
 const marker="import './theme-calendar-alarm-contrast.css';";
 assert.ok(layout.includes(marker),'Missing theme fix stylesheet');
 assert.ok(layout.indexOf(marker)>layout.indexOf("import './plan-footer-admin-contrast.css'"));
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
