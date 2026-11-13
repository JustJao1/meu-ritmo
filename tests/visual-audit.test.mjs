import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const src=file('lib/plans.ts');
const match=src.match(/export const themes=\[([\s\S]*?)\] as const;/);
assert.ok(match,'Theme catalog must remain available');
const themes=[...match[1].matchAll(/\{id:'([^']+)'[^}]*\}/g)].map((m)=>{
  const theme={id:m[1]};
  for(const p of m[0].matchAll(/(paper|side|banner|ink|accent):'(#[0-9a-f]{6})'/g)){theme[p[1]]=p[2];}
  return theme;
});
const channels=(hex)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const luminance=(values)=>values.map(v=>{const n=v/255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[0.2126,0.7152,0.0722][i],0);
const contrast=(a,b)=>{const l1=luminance(a),l2=luminance(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)};
const mixed=(ink,accent)=>channels(ink).map((v,i)=>Math.round(v*.78+channels(accent)[i]*.22));

test('all 22 named themes are defined and have valid complete palettes',()=>{
  assert.equal(themes.length,22);
  assert.equal(new Set(themes.map(t=>t.id)).size,22);
  for(const theme of themes)for(const name of ['paper','ink','side','banner','accent']){
    assert.match(theme[name]||'',/^#[0-9a-f]{6}$/,theme.id+' '+name);
  }
});

test('main text meets AAA contrast on every theme surface',()=>{
  for(const theme of themes)for(const surface of ['paper','side','banner']){
    const ratio=contrast(channels(theme.ink),channels(theme[surface]));
    assert.ok(ratio>=7,theme.id+' '+surface+': '+ratio.toFixed(2));
  }
});

test('readable accent token meets AAA contrast over all 22 palettes',()=>{
  const css=file('app/theme-contrast-audit.css');
  assert.match(css,/--theme-accent-readable:color-mix\(in srgb,var\(--ink\) 78%,var\(--accent\) 22%\)/);
  for(const theme of themes)for(const surface of ['paper','side','banner']){
    const ratio=contrast(mixed(theme.ink,theme.accent),channels(theme[surface]));
    assert.ok(ratio>=7,theme.id+' accent on '+surface+': '+ratio.toFixed(2));
  }
});

test('all UI refinements load after the existing design and font sheets',()=>{
  const layout=file('app/layout.tsx');
  const styles=[
    './font-global-fix.css',
    './workspace-redesign.css',
    './internal-pages-audit.css',
    './theme-contrast-audit.css',
    './forms-dialogs-audit.css'
  ];
  const positions=styles.map(name=>layout.indexOf(name));
  assert.ok(positions.every(pos=>pos>=0),'Required stylesheet import is missing');
  assert.deepEqual(positions,[...positions].sort((a,b)=>a-b),'Cascade order changed');
});

test('all five authenticated areas and their visual hooks remain present',()=>{
  const app=file('app/ritmo.tsx');
  const css=file('app/internal-pages-audit.css')+file('app/workspace-redesign.css');
  for(const area of ['Hoje','Agenda','Gastos','Notas','Rotina'])assert.ok(app.includes(area),'Area '+area+' missing');
  for(const hook of ['.todaygrid','.eventrow','.financesummary','.notesgrid','.routinedays','.monthgrid','.settingspanel','.communityintro','.studiointro']){
    assert.ok(css.includes(hook),'Missing visual hook '+hook);
  }
});

test('forms, confirmation windows, mobile layouts and reduced-motion styles have coverage',()=>{
  const css=file('app/forms-dialogs-audit.css');
  const pages=file('app/internal-pages-audit.css');
  const themes=file('app/theme-contrast-audit.css');
  for(const selector of ['.overlay','.dialog','.authsheet','.profileeditor','.privacycenter','.dialogactions']){
    assert.ok(css.includes(selector),'Missing form/dialog hook '+selector);
  }
  assert.match(css,/@media\(max-width:650px\)/);
  assert.match(pages,/@media\(max-width:700px\)/);
  assert.match(themes, /prefers-contrast:more/);
  assert.match(pages, /prefers-reduced-motion:reduce/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
