import {occurs,isDone,type Item} from './ritmo-domain';
export type AssistantOptions={date:string;start:string;end:string;duration:number;id:()=>string};
export type AssistantDraft={item:Item;replaceId?:string;warning?:string};
export type AssistantResult={drafts:AssistantDraft[];questions:string[];answer?:string};
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));
const clock=(n:number)=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const addDays=(s:string,n:number)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const weekday=(s:string)=>String(new Date(s+'T12:00:00Z').getUTCDay());
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(new Date(s+'T12:00:00Z').getTime())&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const dayNames=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
const initial=(type:Item['type'],title:string,o:AssistantOptions):Item=>({id:o.id(),type,title,date:o.date,time:'',end:'',amount:0,category:'Outros',body:'',color:'blue',repeat:'none',done:false,pinned:false,archived:false,tags:'',days:[],notify:false,checks:[]});
export function overlaps(a:Item,b:Item,defaultDuration=30){
 if(a.id===b.id||!a.time||!b.time||a.type==='expense'||b.type==='expense'||a.archived||b.archived)return false;
 const timeOverlap=minutes(a.time)<(b.end?minutes(b.end):minutes(b.time)+defaultDuration)&&(a.end?minutes(a.end):minutes(a.time)+defaultDuration)>minutes(b.time);
 if(!timeOverlap)return false;
 const recurring=(x:Item)=>x.repeat!=='none'||x.days.length>0;
 if(!recurring(a))return occurs(a,a.date)&&occurs(b,a.date);
 if(!recurring(b))return occurs(a,b.date)&&occurs(b,b.date);
 const start=a.date>b.date?a.date:b.date;
 // A complete yearly cycle covers daily, weekly and monthly combinations.
 for(let i=0;i<366;i++){const d=addDays(start,i);if(occurs(a,d)&&occurs(b,d))return true;}
 return false;
}
function nextSlot(item:Item,items:Item[],o:AssistantOptions,duration:number){
 for(let n=minutes(o.start);n+duration<=minutes(o.end);n+=15){const proposed={...item,time:clock(n),end:clock(n+duration)};if(!items.some(x=>overlaps(proposed,x,o.duration)))return proposed;}return null;
}
export function planAssistant(command:string,items:Item[],o:AssistantOptions):AssistantResult{
 const result:AssistantResult={drafts:[],questions:[]},text=norm(command.trim());
 if(!validDate(o.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(o.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(o.end)||o.start>=o.end||o.duration<5||o.duration>240){result.questions.push('Confira a data, a duração e os horários disponíveis.');return result;}
 if(/^(quanto|quais|o que|me mostre|mostrar|resumo)/.test(text)){
  if(/gast|despes/.test(text)){
   if(/passad|anterior|proxim|seguinte|amanha|ontem|\d{1,2}\//.test(text)){result.questions.push('Nesta versão, consulte os gastos de hoje ou deste mês. Para outros períodos, use a área Gastos.');return result;}
   const month=o.date.slice(0,7),days=new Date(+o.date.slice(0,4),+o.date.slice(5,7),0).getDate();
   const categories:Record<string,string>={alimentacao:'Alimentação',mercado:'Alimentação',transporte:'Transporte',casa:'Casa',lazer:'Lazer',saude:'Saúde',educacao:'Educação'};
   const category=Object.entries(categories).find(([word])=>text.includes(word))?.[1];
   if(!/mes|hoje/.test(text)){result.questions.push('Você quer consultar os gastos de hoje ou deste mês?');return result;}
   const dates=/hoje/.test(text)?[o.date]:Array.from({length:days},(_,i)=>month+'-'+String(i+1).padStart(2,'0'));
   const total=items.filter(x=>x.type==='expense'&&(!category||x.category===category)).reduce((sum,x)=>sum+dates.filter(d=>occurs(x,d)).length*x.amount,0);
   result.answer='Total registrado'+(category?' em '+category:'')+': '+total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+(/hoje/.test(text)?' hoje.':' neste mês, incluindo recorrências previstas.');return result;
  }
  if(/hoje|amanha/.test(text)){
   const date=text.includes('amanha')?addDays(o.date,1):o.date;
   const list=items.filter(x=>['task','event','reminder','alarm'].includes(x.type)&&occurs(x,date)&&!isDone(x,date));
   result.answer=list.length?list.map(x=>(x.time||'Sem horário')+' · '+x.title).join('\n'):'Nenhuma atividade pendente registrada para essa data.';return result;
  }
 }
 if(/^(organiza|organize|planeja|planeje|organizar|planejar) (meu dia|minha semana|o dia|a semana|minha rotina)/.test(text)){
  const week=/semana/.test(text),count=week?7:1;
  const candidates=items.filter(x=>x.type==='task'&&!x.archived&&!x.done&&!x.time&&x.repeat==='none'&&!x.days.length&&x.date<=addDays(o.date,count-1)).slice(0,20);
  if(!candidates.length){result.answer='Não há tarefas sem horário para distribuir. Crie uma tarefa manualmente ou escreva, por exemplo: estudar inglês amanhã por 45 minutos.';return result;}
  const occupied=[...items];
  for(const original of candidates){let proposed:Item|null=null;for(let i=0;i<count&&!proposed;i++){const date=addDays(o.date,i);if(date<original.date)continue;proposed=nextSlot({...original,date},occupied,o,o.duration);}
   if(!proposed){result.questions.push('Não encontrei espaço para “'+original.title+'”. Amplie os horários disponíveis ou reduza a duração.');continue;}
   occupied.push(proposed);result.drafts.push({item:proposed,replaceId:original.id});
  }return result;
 }
 const parts=/^(?:anote|anotar|nota:|crie uma nota)\s*/i.test(command.trim())?[command.trim()]:command.split(/\n|;|\s+e\s+(?=(?:preciso|quero|tenho|gastei|paguei|anote|crie|criar|adicionar|estudar|treinar|trabalho|me lembre|lembrar)\b)/i).map(s=>s.trim()).filter(Boolean);
 if(parts.length>12){result.questions.push('Organize até 12 pedidos por vez.');return result;}
 for(const original of parts){
  const s=norm(original);
  if(/\b(exclu|apag|remov|cancel|transfer|envi|compr|recebi|receita|ganhei|salario)\w*/.test(s)&&!/^\s*(?:anote|nota:)/.test(s)&&!/comprar|compras/.test(s)){
   result.questions.push('Para “'+original.slice(0,90)+'”, use a edição manual. O assistente não exclui registros, realiza pagamentos nem envia mensagens.');continue;
  }
  let type:Item['type']=/^\s*(gastei|paguei|registrar gasto|registre gasto|gasto|despesa)/.test(s)?'expense':/^\s*(anote|anotar|nota:|crie uma nota)/.test(s)?'note':/\b(reuniao|consulta|dentista|medico|compromisso|aula|trabalho das)\b/.test(s)?'event':/\b(lembre|lembrete|lembrar)\b/.test(s)?'reminder':'task';
  if(type==='task'&&!/^(?:preciso|quero|tenho que|tarefa|crie|criar|adicione|adicionar|coloque|agende|marque|estudar|estudo|treinar|treino|ler|leitura|fazer|caminhar|caminhada|pagar|comprar|organizar|trabalhar|trabalho|revisar|terminar|concluir|ligar|buscar|levar|limpar|lavar|tomar|beber|preparar|cozinhar|dormir|acordar)\b/.test(s)){
   result.questions.push('Não consegui identificar a ação em “'+original.slice(0,100)+'”. Comece com “criar tarefa”, “gastei”, “reunião”, “me lembre” ou “anote”.');continue;
  }
  const item=initial(type,original,o);
  if(type==='note'){item.title=original.replace(/^(anote|anotar|nota:|crie uma nota)\s*:?[ ]*/i,'').trim().slice(0,200);item.body=original.replace(/^(anote|anotar|nota:|crie uma nota)\s*:?[ ]*/i,'').trim();if(!item.title)result.questions.push('O que você quer anotar?');else result.drafts.push({item});continue;}
  let date=o.date;
  if(/depois de amanha/.test(s))date=addDays(o.date,2);else if(/amanha/.test(s))date=addDays(o.date,1);
  const explicit=s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if(explicit){date=(explicit[3]||o.date.slice(0,4))+'-'+explicit[2].padStart(2,'0')+'-'+explicit[1].padStart(2,'0');if(!validDate(date)){result.questions.push('A data em “'+original+'” não é válida.');continue;}if(!explicit[3]&&date<o.date)date=String(+o.date.slice(0,4)+1)+date.slice(4);}
  if(/ontem|proxima semana|proximo mes|semana que vem|mes que vem|\bem \d+ dias?\b|ate sexta|ate segunda|ate terca|ate quarta|ate quinta|ate sabado|ate domingo/.test(s)){result.questions.push('Informe uma data exata para “'+original.slice(0,90)+'”, por exemplo 20/11/2026.');continue;}
  if(/segunda a sexta|dias uteis/.test(s))item.days=['1','2','3','4','5'];
  else if(/todos os dias|todo dia|diariamente/.test(s))item.repeat='daily';
  else {
   const days=dayNames.map((name,i)=>s.includes(name)?String(i):'').filter(Boolean);
   if(/toda|todo|semanal/.test(s)&&days.length)item.days=days;
   else if(days.length>1){result.questions.push('As atividades de “'+original.slice(0,90)+'” devem se repetir toda semana? Escreva “toda terça e quinta”, por exemplo.');continue;}
   else if(days.length){for(let i=0;i<7;i++){const d=addDays(date,i);if(weekday(d)===days[0]){date=d;break;}}}
  }
  if(/todo mes|mensalmente/.test(s))item.repeat='monthly';
  if(item.days.length){for(let i=0;i<7;i++){const d=addDays(date,i);if(item.days.includes(weekday(d))){date=d;break;}}}
  item.date=date;
  const range=s.match(/\bdas?\s+(\d{1,2})(?::([0-5]\d)|h([0-5]\d)?)?\s*(?:as|ate|a)\s*(\d{1,2})(?::([0-5]\d)|h([0-5]\d)?)?\b/);
  const time=s.match(/\b(?:as|pelas)\s*(\d{1,2})(?::(\d{2})|h(\d{2})?)?\b/)||s.match(/\b(\d{1,2})h(\d{2})?\b/);
  let duration=o.duration;
  const dur=s.match(/(?:por|durante)\s+(\d{1,3})\s*(minutos?|min|horas?|h)\b/)||s.match(/\b(\d{1,3})\s+(minutos?|horas?)\b/);
  const wordDur=s.match(/\b(?:por\s+|durante\s+)?(uma|duas|meia)\s+horas?\b/);
  if(dur)duration=Number(dur[1])*(/^(h|hora)/.test(dur[2])?60:1);
  if(wordDur)duration=wordDur[1]==='duas'?120:wordDur[1]==='meia'?30:60;
  if(duration<5||duration>240){result.questions.push('Use uma duração entre 5 minutos e 4 horas para cada atividade.');continue;}
  if(range){item.time=range[1].padStart(2,'0')+':'+(range[2]||range[3]||'00');item.end=range[4].padStart(2,'0')+':'+(range[5]||range[6]||'00');}
  else if(time){item.time=time[1].padStart(2,'0')+':'+(time[2]||time[3]||'00');if(type!=='expense')item.end=clock(minutes(item.time)+duration);}
  if(item.time&&(minutes(item.time)>=1440||!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))||item.end&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.end)||item.end<=item.time)){
   result.questions.push('Confira o horário em “'+original.slice(0,100)+'”. O término deve ser no mesmo dia e depois do início.');continue;
  }
  if(type==='expense'){
   const moneyPattern='(\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+[,.]\\d{1,2}|\\d+)(?![\\d/,h])';
   const value=s.match(new RegExp('r\\$\\s*'+moneyPattern))||s.match(new RegExp('^(?:gastei|paguei|registrar gasto|registre gasto|gasto|despesa)\\s*(?:de\\s+)?'+moneyPattern));
   if(!value){result.questions.push('Qual é o valor do gasto? Exemplo: gastei R$ 45,90 no mercado hoje.');continue;}
   const raw=value[1];item.amount=Number(raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw);if(!Number.isFinite(item.amount)||item.amount<=0||item.amount>999999999){result.questions.push('Informe um valor de gasto válido.');continue;}
   const cats:[RegExp,string][]=[[/mercado|restaurante|comida|alimentacao|padaria/,'Alimentação'],[/uber|onibus|combustivel|gasolina|transporte/,'Transporte'],[/aluguel|internet|energia|agua|casa/,'Casa'],[/farmacia|medico|saude/,'Saúde'],[/curso|livro|escola|educacao/,'Educação'],[/cinema|jogo|lazer/,'Lazer']];item.category=cats.find(([r])=>r.test(s))?.[1]||'Outros';
  }
  let title=original.replace(/^(?:preciso\s+(?:de\s+)?|quero\s+|tenho que\s+|crie uma?\s+|criar\s+|adicione\s+|adicionar\s+|coloque\s+|agende\s+|marque\s+|tarefa\s*:?\s*|me lembre de\s+|lembrete\s*:?\s*)/i,'');
  title=title.replace(/\s+(?:hoje|amanhã|depois de amanhã|todos os dias|todo dia|diariamente|toda\s+|todo\s+|de segunda a sexta|segunda a sexta|nos dias úteis|às\s+|as\s+|das\s+|por\s+|durante\s+|\d{1,2}h|\d{1,2}\/\d{1,2}).*$/i,'').trim();
  item.title=(title||original).slice(0,200);
  if(type==='event'&&!item.time){result.questions.push('Qual é o horário de “'+item.title+'”? Informe início e duração ou início e fim.');continue;}
  if(type==='reminder'&&!item.time){result.questions.push('A que horas você quer o lembrete “'+item.title+'”?');continue;}
  if(type==='reminder'){item.notify=true;item.end='';}
  if(type==='task'&&!item.time&&(dur||wordDur)){
   const slot=nextSlot(item,[...items,...result.drafts.map(d=>d.item)],o,duration);if(!slot){result.questions.push('Não encontrei um horário livre para “'+item.title+'”. Ajuste sua disponibilidade.');continue;}Object.assign(item,slot);
  }
  const occupied=[...items,...result.drafts.map(d=>d.item)];
  const conflicts=occupied.filter(x=>overlaps(item,x,o.duration));
  const duplicate=occupied.some(x=>x.type===item.type&&norm(x.title)===norm(item.title)&&x.date===item.date&&x.time===item.time&&!x.archived);
  if(duplicate){result.questions.push('Já existe um registro semelhante a “'+item.title+'” nessa data e horário. Confira antes de criar outro.');continue;}
  result.drafts.push({item,...(conflicts.length?{warning:'Conflito com: '+conflicts.map(x=>x.title).slice(0,3).join(', ')}:{})});
 }
 if(!result.drafts.length&&!result.questions.length)result.questions.push('Escreva uma tarefa, compromisso, gasto, nota ou lembrete para organizar.');
 return result;
}
