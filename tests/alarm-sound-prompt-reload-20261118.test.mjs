import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('components/alarm-player.tsx','utf8');

test('o aviso de testar som espera a preferência salva e não reaparece após ativação',()=>{
 assert.match(source,/const \[audioPreferenceLoaded,setAudioPreferenceLoaded\]=useState\(false\)/);
 assert.match(source,/localStorage\.getItem\('mr_alarm_audio_ack_v1'\)==='1'/);
 assert.match(source,/setAudioPreferenceLoaded\(true\)/);
 assert.match(source,/soundWanted&&audioPreferenceLoaded&&!acknowledged&&!ready&&!active/);
});

test('os alarmes ainda desbloqueiam o som no próximo gesto após atualizar a página',()=>{
 assert.match(source,/if\(!acknowledged\|\|ready\)return;/);
 assert.match(source,/window\.addEventListener\('pointerdown',unlock/);
 assert.match(source,/window\.addEventListener\('keydown',unlock/);
 assert.match(source,/\{active&&<div className="alarmbackdrop"/);
 assert.match(source,/\{!ready&&<button className="alarmnotice-enable"/);
});
