import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
test('main site app links resolve to the canonical /download route',()=>{
 const app=read('app/ritmo.tsx'),page=read('app/download/page.tsx'),legacy=read('app/downloads/page.tsx');
 assert.ok(app.includes('/download?theme=paper'));
 assert.ok(app.includes('className="mobile-apps-link"'));
 assert.match(page,/export default function DownloadPage/);
 assert.match(legacy,/redirect\('\/download'\)/);
 assert.doesNotMatch(legacy,/meu-ritmo-lite/);
});
test('download version matches a real release URL and retains account access',()=>{
 const version=JSON.parse(read('public/android-version.json'));
 assert.ok(version.apkUrl.startsWith('https://github.com/JustJao1/meu-ritmo-app/releases/download/'));
 assert.ok(version.apkUrl.endsWith('.apk'));
 const page=read('app/download/page.tsx');
 assert.match(page,/import android from '\.\.\/\.\.\/public\/android-version\.json'/);
 assert.match(page,/href=\{android\.apkUrl\}/);
 assert.match(page,/href="\/app"/);
 assert.match(page,/beforeinstallprompt/);
 assert.match(page,/appinstalled/);
});
test('download page is translated and responsive without changing auth or billing',()=>{
 const page=read('app/download/page.tsx'),translations=read('components/language-selector.tsx'),css=read('app/download-page.css');
 const keys=[...page.matchAll(/\bt\((['"])(.*?)\1\)/g)].map(m=>m[2]);
 const dict=translations.match(/const translations:Record<string,\[string,string\]>=\{([\s\S]*?)\n\};/)[1];
 for(const key of keys)assert.ok(dict.includes(JSON.stringify(key)+':'),key+' missing translation');
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(read('app/layout.tsx'),/import '\.\/download-page\.css'/);
 assert.doesNotMatch(page,/supabase_service_role|asaas_api_key|fetch\(['"]\/api\/billing/i);
});
