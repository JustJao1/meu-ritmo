import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('app/ritmo.tsx','utf8');
const translations=readFileSync('components/language-selector.tsx','utf8');
test('Planos remains in sidebar navigation, opening existing pricing comparison',()=>{
 const sidebar=source.slice(source.indexOf('<aside className="sidebar">'),source.indexOf('<div className="sidebottom">'));
 assert.ok(sidebar.includes('aria-haspopup="dialog" onClick={()=>setPanel(\'Planos\')}><Ticket size={20}/><span>{t(\'Planos\')}</span></button></nav>'));
 assert.ok(source.includes("panel === 'Planos' ? plans()"));
 assert.ok(translations.includes('"Planos":["Plans","Planes"]'));
});
