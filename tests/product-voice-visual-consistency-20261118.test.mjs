import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name)=>readFileSync(name,'utf8');
const plans=read('lib/plans.ts');
const app=read('app/ritmo.tsx');
const landing=read('app/landing-refinement.css');
const comfort=read('app/comfort-polish.css');
const messages=read('lib/daily-motivation.ts');
const dictionary=read('components/language-selector.tsx');
const pricing=read('components/plan-comparison.tsx');
const studio=read('components/premium-studio.tsx');

test('acolhimento é global, não uma opção de tema/fonte chamada Acolhedora',()=>{
 assert.doesNotMatch(plans,/name:'Acolhedora'/);
 assert.match(plans,/id:'humanist',name:'Arredondada'/);
 assert.doesNotMatch(dictionary,/"Acolhedora":/);
 for(const id of ['sans','humanist','modern','editorial','classic','reading']){
  assert(plans.includes("id:'"+id+"'"),id);
 }
 for(const selector of ['.landing .herotext h1','.appframe .sidebar nav>button','.adminshell .adminmain','.authpage .authsheet','.legalpage p'])
  assert(comfort.includes(selector),selector);
});

test('três ilustrações relevantes são colocadas ao lado do texto sem ícones repetidos',()=>{
 for(const scene of ['routine','finance','notes'])assert(app.includes('<OrganizingIllustration kind="'+scene+'"/>'));
 assert(!app.includes('className="featureicon coral"'));
 assert(!app.includes('className="featureicon blue"'));
 assert(!app.includes('className="featureicon yellow"'));
 assert.match(landing,/grid-template-columns:clamp\(104px,10vw,142px\) minmax\(0,1fr\)/);
 assert.match(landing,/features article>\.organizing-illustration/);
 assert(!app.includes('QUINTA-FEIRA, 12 DE NOVEMBRO'));
 assert(!app.includes('className="blueasterisk"'));
});

test('mensagens do cotidiano são completas, úteis e disponíveis em três idiomas',()=>{
 assert.match(messages,/const notes:Record<Locale/);
 assert(!messages.includes('starts:['));
 assert(!messages.includes('ends:['));
 assert(messages.includes('Confira a agenda antes de começar a primeira tarefa.'));
 assert(messages.includes('Check your calendar before starting your first task.'));
 assert(messages.includes('Revisa tu agenda antes de empezar la primera tarea.'));
 assert(app.includes('RESUMO DE HOJE'));
 assert(app.includes('Nenhum compromisso na agenda de hoje.'));
 assert(app.includes('Nenhuma tarefa cadastrada para hoje.'));
});

test('planos e estúdio explicam benefícios e escolhas sem promessas vagas',()=>{
 assert(pricing.includes('9 temas adicionais, 6 cores e 6 fontes para títulos'));
 assert(pricing.includes('Mais personalização e espaços compartilhados.'));
 assert(studio.includes('Escolha a letra dos títulos.'));
 assert(!studio.includes('Um jeito diferente de ver o dia.'));
 assert(!plans.includes("name:'Acolhedora'"));
});

test('novos textos visíveis têm tradução para inglês e espanhol',()=>{
 for(const key of ['Arredondada','SEU DIA, SEU ESPAÇO','RESUMO DE HOJE','UM EXEMPLO DO SEU DIA','Tarefas, agenda e gastos em um só lugar.','Ajuste cores, títulos e espaçamento.']){
  assert(dictionary.includes(JSON.stringify(key)+':['),key);
 }
});
