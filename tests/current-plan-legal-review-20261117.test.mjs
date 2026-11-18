import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const cards=readFileSync('components/plan-comparison.tsx','utf8');
const css=readFileSync('app/current-plan-highlight.css','utf8');
const layout=readFileSync('app/layout.tsx','utf8');
const legal=readFileSync('components/legal-page.tsx','utf8');
const translations=readFileSync('components/legal-localized-text.tsx','utf8');

test('plano atual é exibido no topo do cartão certo, inclusive na demonstração',()=>{
 assert.match(cards,/showCurrent&&current===id\?'true':undefined/);
 assert.match(cards,/className=\{'plancard'\+\(showCurrent&&current===id\?' plancard--current':'?'\)\}/);
 assert.match(cards,/className="plan-card-heading"/);
 assert.match(cards,/className="currentplan" role="status"/);
 assert.match(cards,/demo\?'Plano simulado':'Seu plano atual'/);
 assert.ok(cards.indexOf('className="currentplan"') < cards.indexOf('className="planprice"'));
 assert.ok(cards.indexOf('className="currentplan"') < cards.indexOf('className="plantry"'));
});
test('destaque se adapta aos temas, mantém contraste e funciona no celular',()=>{
 assert.match(css,/\.plancomparison \.plancard\.plancard--current/);
 assert.match(css,/background:var\(--ink\);/);
 assert.match(css,/color:var\(--paper\);/);
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(layout,/import '\.\/current-plan-highlight\.css'/);
 assert.doesNotMatch(css,/#(?:[0-9a-f]{3}){1,2}\b/i);
});
test('política informa direitos LGPD, alternativas sem login e regras de maioridade nos três idiomas',()=>{
 assert.match(legal,/confirmação do tratamento/);
 assert.match(legal,/pelo botão Cookies no rodapé/);
 assert.match(legal,/A comunidade é destinada a pessoas com 18 anos ou mais/);
 assert.match(translations,/confirmation of processing/);
 assert.match(translations,/confirmación del tratamiento/);
 assert.match(translations,/aged 18 or older/);
 assert.match(translations,/mayores de 18 años/);
 assert.match(legal,/17 DE NOVEMBRO DE 2026/);
 assert.match(translations,/UPDATED NOVEMBER 17, 2026/);
});
