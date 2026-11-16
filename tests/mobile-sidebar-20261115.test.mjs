import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
const app=read('app/ritmo.tsx');
const nav=read('app/public-header-refinement.css');
const card=read('app/daily-motivation.css');
const component=read('components/daily-motivation.tsx');
const translations=read('components/language-selector.tsx');

test('daily message lives only in sidebar card, not the Hoje heading',()=>{
  const sidebar=app.slice(app.indexOf('<aside className="sidebar">'),app.indexOf('</aside>'));
  assert.match(sidebar,/className="planpitch daily-pitch"/);
  assert.match(sidebar,/UMA FRASE PARA HOJE/);
  assert.match(sidebar,/<DailyMotivation\/>/);
  assert.equal((app.match(/<DailyMotivation\/>/g)||[]).length,1);
  assert.doesNotMatch(app,/area==='Hoje'&&<DailyMotivation\/>/);
  assert.match(component,/setInterval\(\(\)=>setToday\(localDate\(\)\),60_000\)/);
  assert.match(translations,/"UMA FRASE PARA HOJE":\["A THOUGHT FOR TODAY","UNA FRASE PARA HOY"\]/);
});

test('plans has one sidebar entry and the daily quote has no extra CTA',()=>{
  const daily=app.match(/<div className="planpitch daily-pitch">([\s\S]*?)<\/div>/)?.[1];
  assert(daily);
  assert.match(daily,/<DailyMotivation\/>/);
  assert.doesNotMatch(daily,/planpitch-cta|<button/);
  assert.match(app,/aria-haspopup="dialog" onClick=\{\(\)=>setPanel\('Planos'\)\}/);
});

test('mobile public navigation separates brand, login, language and app link into two rows',()=>{
  const header=app.slice(app.indexOf('<header className="publicnav">'),app.indexOf('</header>',app.indexOf('<header className="publicnav">')));
  assert.match(header,/<LanguageSelector className="mr-language-public"\/>/);
  assert.match(header,/<nav>[\s\S]*className="androiddownloadlink"[\s\S]*<\/nav><a className="publicnav-login" href="\/app">/);
  assert.equal((header.match(/href="\/app"/g)||[]).length,1);
  assert.match(nav,/@media\(max-width:700px\)/);
  assert.match(nav,/grid-template-areas:"brand login" "language apps"/);
  assert.match(nav,/\.landing \.publicnav>\.mr-language-public select\{/);
  assert.match(nav,/\.landing \.publicnav>nav>a\.androiddownloadlink\{/);
  assert.match(nav,/\.landing \.publicnav>\.publicnav-login\{/);
  assert.doesNotMatch(nav,/nav>a:last-child/);
});

test('header controls remain single-line, bounded and accessible in small viewports',()=>{
  assert.match(nav,/@media\(max-width:380px\)/);
  assert.match(nav,/white-space:nowrap/);
  assert.match(nav,/width:min\(165px,100%\)/);
  assert.match(nav,/grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(nav,/focus-visible/);
});
