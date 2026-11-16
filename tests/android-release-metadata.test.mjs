import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const download=JSON.parse(readFileSync('public/android-version.json','utf8'));
const release=JSON.parse(readFileSync('lib/android-release.json','utf8'));

test('Android metadata agree on the currently published signed APK',()=>{
 assert.equal(release.available,true);
 assert.equal(download.apkUrl,release.url);
 assert.equal(download.versionName,release.version);
 assert.match(download.apkUrl,/^https:\/\/github\.com\/JustJao1\/meu-ritmo-app\/releases\/download\/v\d+\.\d+\.\d+\/Meu-Ritmo-\d+\.\d+\.\d+\.apk$/);
 assert.match(release.sha256,/^[a-f0-9]{64}$/);
 assert.ok(Number.isInteger(release.size)&&release.size>0);
 assert.ok(download.latestVersionCode>=download.minSupportedVersionCode);
});
