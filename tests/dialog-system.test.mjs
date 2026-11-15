import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const areas=[
 'app/ritmo.tsx',
 'components/shared-spaces.tsx',
 'components/community.tsx',
 'components/admin-panel.tsx',
 'components/admin-extras.tsx',
 'components/profile-editor.tsx',
 'components/privacy-center.tsx',
 'components/premium-studio.tsx'
];
function visibleCodeFiles(directory){
 return readdirSync(new URL('../'+directory+'/',import.meta.url)).flatMap(entry=>{
  if(entry==='ui')return [];
  const path=directory+'/'+entry;
  if(statSync(new URL('../'+path,import.meta.url)).isDirectory())return visibleCodeFiles(path);
  return /\\.(?:tsx|jsx|ts|js)$/.test(entry)?[path]:[];
 });
}
test('no app or first-party component uses native browser dialogs',()=>{
 for(const path of [...visibleCodeFiles('app'),...visibleCodeFiles('components')]){
  const source=read(path);
  const native=/(?<![\\w.])(?:window\\.|globalThis\\.)?(?:confirm|prompt|alert)\\s*\\(/g;
  assert.equal([...source.matchAll(native)].length,0,path+' still uses a blocking browser dialog');
 }
});
test('critical browser confirmations use the Meu Ritmo dialog rather than native blocking popups',()=>{
 for(const area of areas){
  const source=read(area);
  assert.match(source,/useAppDialog/,area+' must use the shared dialog provider');
  const native=/(?<![\w.])(?:window\.)?(?:confirm|prompt|alert)\s*\(/g;
  assert.equal([...source.matchAll(native)].length,0,area+' still has a browser confirm/prompt/alert');
 }
});
test('the shared dialog has labeled controls, keyboard support, destructive and typed confirmation',()=>{
 const source=read('components/app-dialog-provider.tsx');
 assert.match(source,/RadixDialog\.Content/);
 assert.match(source,/RadixDialog\.Title/);
 assert.match(source,/RadixDialog\.Description/);
 assert.match(source,/RadixDialog\.Overlay/);
 assert.match(source,/onOpenChange=/);
 assert.match(source,/aria-describedby=/);
 assert.match(source,/id="mr-confirm-input"/);
 assert.match(source,/value===active\.options\.expectedValue/);
 assert.match(source,/disabled=\{!canSubmit\}/);
 assert.match(source,/intent==='danger'/);
});
test('dialog provider is global and dialog colors inherit user theme',()=>{
 const layout=read('app/layout.tsx');
 assert.match(layout,/<AppDialogProvider>/);
 assert.match(layout,/<\/AppDialogProvider>/);
 const style=read('app/app-dialogs.css');
 assert.match(style,/background:var\(--paper\)/);
 assert.match(style,/color:var\(--ink\)/);
 assert.match(style,/@media\(max-width:600px\)/);
});
test('space deletion still validates the exact confirmation on the server',()=>{
 const source=read('app/api/spaces/route.ts');
 assert.match(source,/if\(a\.confirmName!==s\.name\)/);
 assert.match(source,/s\.owner_id!==user\.userId/);
 assert.match(read('components/shared-spaces.tsx'),/expectedValue:selected\.name/);
});
test('dialog text is available in Brazilian Portuguese, English and Spanish',()=>{
 const dict=read('components/language-selector.tsx');
 const keys=new Set([...dict.matchAll(/"((?:\\.|[^"\\])*)":\[/g)].map(m=>JSON.parse('"'+m[1]+'"')));
 for(const area of [...areas,'components/app-dialog-provider.tsx']){
  const source=read(area);
  const used=[...source.matchAll(/\b(?:t|tr|translateTab)\((['"])(.*?)\1\)/g)].map(m=>m[2]);
  // Ignore unrelated older strings not part of the confirmation feature.
  const dialogSource=area==='components/app-dialog-provider.tsx'?used:[...source.matchAll(/(?:title|description|confirmText|cancelText):(?:tr|t|translateTab)\((['"])(.*?)\1\)/g)].map(m=>m[2]);
  for(const key of dialogSource)assert.ok(keys.has(key),area+' missing dialog translation '+key);
 }
});
