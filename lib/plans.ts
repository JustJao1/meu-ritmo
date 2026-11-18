import type {Data} from './ritmo-domain';
export type Plan='free'|'plus'|'pro';
/** Fontes de títulos: pilhas locais para não depender de terceiros ou alterar o corpo de texto. */
export const titleFonts=[
 {id:'sans',name:'Original',description:'Limpa e familiar',family:'"Meu Ritmo UI", "Segoe UI", Arial, sans-serif'},
 {id:'humanist',name:'Arredondada',description:'Traços abertos e legíveis',family:'"Trebuchet MS", "Segoe UI", Arial, sans-serif'},
 {id:'modern',name:'Contemporânea',description:'Simples e arejada',family:'"Segoe UI", "Helvetica Neue", Arial, sans-serif'},
 {id:'editorial',name:'Editorial',description:'Elegante e discreta',family:'Georgia, "Times New Roman", serif'},
 {id:'classic',name:'Clássica',description:'Traços de livro',family:'"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif'},
 {id:'reading',name:'Leitura',description:'Serena e confortável',family:'Cambria, "Hoefler Text", Georgia, serif'}
] as const;
export type TitleStyle=(typeof titleFonts)[number]['id'];
export type Appearance={theme:'paper'|'tide'|'clay'|'olive'|'midnight'|'forest'|'espresso'|'slate'|'sand'|'rose'|'obsidian'|'amethyst'|'burgundy'|'ocean'|'graphite'|'copper'|'abyss'|'blackout'|'eclipse'|'noir'|'deep-space'|'evergreen';accent:string;badge:'initial'|'sun'|'leaf'|'moon'|'spark';noteStyle:'plain'|'lined'|'dots';density:'airy'|'compact';titleStyle:TitleStyle};
export const defaultAppearance:Appearance={theme:'paper',accent:'#e9785d',badge:'initial',noteStyle:'plain',density:'airy',titleStyle:'sans'};
export const planConfig={free:{name:'Gratuito',monthly:0,yearly:0,pins:3,templates:0},plus:{name:'Plus',monthly:19.90,yearly:199.90,pins:20,templates:0},pro:{name:'Pro',monthly:29.90,yearly:299.90,pins:100,templates:20}};
export const themes=[{id:'paper',name:'Papel',description:'O original, com coral e verde suave.',paper:'#faf9f5',side:'#f0f1e9',banner:'#e9eddf',ink:'#2b302b',accent:'#e9785d'},{id:'tide',name:'Maré',description:'Azul lavado, papel fresco e detalhes do mar.',paper:'#f4f8fa',side:'#e8f0f4',banner:'#ddeaf2',ink:'#293742',accent:'#3868ac'},{id:'clay',name:'Terracota',description:'Areia, argila e um amarelo bem dosado.',paper:'#fbf6ef',side:'#f3eade',banner:'#f0dfce',ink:'#40352d',accent:'#ae503b'},{id:'olive',name:'Oliva',description:'Papel de tom verde e contrastes naturais.',paper:'#f6f8f0',side:'#eaf0df',banner:'#e0e8cf',ink:'#30392b',accent:'#677c3c'},{id:'midnight',name:'Meia-noite',description:'Grafite profundo e coral suave.',paper:'#151b20',side:'#10161b',banner:'#24313a',ink:'#eef2f0',accent:'#fa9077'},{id:'forest',name:'Floresta noturna',description:'Verde escuro e detalhes de sálvia.',paper:'#17221e',side:'#111c18',banner:'#25392f',ink:'#eef5ec',accent:'#a6d2a0'},{id:'espresso',name:'Café escuro',description:'Marrom intenso e tons de areia.',paper:'#211c1a',side:'#191513',banner:'#382c26',ink:'#f7eee5',accent:'#e6a17b'},{id:'slate',name:'Ardósia',description:'Azul petróleo escuro e detalhes frios.',paper:'#19232b',side:'#121b22',banner:'#293c48',ink:'#eef4f6',accent:'#83c2d7'},{id:'sand',name:'Areia',description:'Neutros quentes e contraste discreto.',paper:'#f8f3ea',side:'#eee5d8',banner:'#e9ddc9',ink:'#3b342e',accent:'#b16d4d'},{id:'rose',name:'Rosé',description:'Papel rosado com detalhes terrosos.',paper:'#fbf5f4',side:'#f2e7e6',banner:'#efddda',ink:'#403334',accent:'#bd6e72'},{id:'obsidian',name:'Obsidiana',description:'Preto profundo com acentos prateados.',paper:'#101114',side:'#090a0c',banner:'#24262b',ink:'#f3f3f4',accent:'#c4c8d2'},{id:'amethyst',name:'Ametista',description:'Roxo escuro e lavanda discreta.',paper:'#1c1726',side:'#15101e',banner:'#30273f',ink:'#f2ebfa',accent:'#c4a2f0'},{id:'burgundy',name:'Vinho',description:'Bordô profundo e rosa queimado.',paper:'#24171d',side:'#1b1116',banner:'#3b2530',ink:'#f9ebef',accent:'#e4a0ae'},{id:'ocean',name:'Oceano profundo',description:'Azul-marinho com detalhes turquesa.',paper:'#101d2a',side:'#0b1520',banner:'#20374b',ink:'#edf7fb',accent:'#78d0cb'},{id:'graphite',name:'Grafite',description:'Cinza carvão com verde menta.',paper:'#1d2022',side:'#15181a',banner:'#303638',ink:'#f2f5f3',accent:'#9ad9c1'},{id:'copper',name:'Cobre',description:'Carvão quente e cobre acetinado.',paper:'#221d1a',side:'#181411',banner:'#382d25',ink:'#f8f0e9',accent:'#d8a174'},{id:'abyss',name:'Abismo',description:'Preto azulado quase absoluto.',paper:'#0a0e13',side:'#070a0e',banner:'#17202b',ink:'#e9f1f7',accent:'#79a9d2'},{id:'blackout',name:'Preto absoluto',description:'Preto puro e cinza minimalista.',paper:'#090909',side:'#050505',banner:'#1b1b1b',ink:'#f2f2f2',accent:'#a9adb5'},{id:'eclipse',name:'Eclipse',description:'Carvão profundo e dourado fosco.',paper:'#11100e',side:'#0b0a09',banner:'#262219',ink:'#f6f0e5',accent:'#c8a66b'},{id:'noir',name:'Noir',description:'Preto neutro com vermelho discreto.',paper:'#0e0e10',side:'#08080a',banner:'#222025',ink:'#f2eef0',accent:'#d77b85'},{id:'deep-space',name:'Espaço profundo',description:'Azul espacial com detalhes violeta.',paper:'#0c0c18',side:'#070711',banner:'#1c1b30',ink:'#eeecfa',accent:'#9b96d6'},{id:'evergreen',name:'Verde abissal',description:'Verde quase preto e menta suave.',paper:'#0b1512',side:'#07100d',banner:'#1c2b25',ink:'#ecf6ef',accent:'#87bca4'}] as const;
export const freeThemeIds=['paper','tide','clay','olive','midnight'] as const;
export function isFreeTheme(theme:string){return (freeThemeIds as readonly string[]).includes(theme);}
export const accentPalette=['#e9785d','#3868ac','#677c3c','#b48126','#ae503b','#596073'];
export const proExclusiveThemes = ['blackout','abyss','eclipse','noir','deep-space','evergreen','obsidian','graphite'] as const;
export function isProExclusiveTheme(theme:string){return (proExclusiveThemes as readonly string[]).includes(theme);}
/** O Plus pode usar as cores de sua paleta e a cor original de qualquer tema não exclusivo do Pro. */
export function isPlusAccentAllowed(themeId:string,accent:string):boolean{
 const selected=themes.find(t=>t.id===themeId);
 return accentPalette.includes(accent)||Boolean(selected&&!isProExclusiveTheme(themeId)&&selected.accent===accent);
}
export function effectiveAppearance(data:Data,plan:Plan):Appearance{const a={...defaultAppearance,...data.appearance};if(plan==='free'){const selected=themes.find(t=>t.id===a.theme&&isFreeTheme(t.id))||themes[0];return {...defaultAppearance,theme:selected.id,accent:selected.accent};}if(plan==='plus'&&isProExclusiveTheme(a.theme))a.theme=defaultAppearance.theme;if(plan==='plus'&&!isPlusAccentAllowed(a.theme,a.accent))a.accent=(themes.find(t=>t.id===a.theme)||themes[0]).accent;return a;}
export function paidChangeError(next:Data,previous:Data|null,plan:Plan){const old=previous?.appearance||defaultAppearance;const a=next.appearance||defaultAppearance;const changed=JSON.stringify(a)!==JSON.stringify(old);if(plan==='free'&&changed){const selected=themes.find(t=>t.id===a.theme);const unchangedPaidDetails=(['badge','noteStyle','density','titleStyle'] as const).every(key=>a[key]===old[key]);if(!selected||!isFreeTheme(selected.id)||a.accent!==selected.accent||!unchangedPaidDetails)return 'Personalização visual faz parte do Plus. Seus dados continuam disponíveis.';}if(plan==='plus'&&isProExclusiveTheme(a.theme)&&a.theme!==old.theme)return 'Este tema é exclusivo do plano Pro.';if(plan==='plus'&&!isPlusAccentAllowed(a.theme,a.accent)&&(a.accent!==old.accent||a.theme!==old.theme))return 'Uma cor de destaque própria faz parte do Pro.';const previousPins=new Set(previous?.items.filter(x=>x.pinned).map(x=>x.id)||[]);if(next.items.filter(x=>x.pinned).length>planConfig[plan].pins&&next.items.some(x=>x.pinned&&!previousPins.has(x.id)))return `Seu plano permite ${planConfig[plan].pins} notas fixadas. As notas existentes continuam acessíveis.`;const oldStickers=new Map(previous?.items.map(x=>[x.id,x.sticker])||[]);if(plan==='free'&&next.items.some(x=>x.sticker&&x.sticker!==oldStickers.get(x.id)))return 'Adesivos de notas fazem parte do Plus.';if(plan!=='pro'&&JSON.stringify(next.routineTemplates||[])!==JSON.stringify(previous?.routineTemplates||[])&&(next.routineTemplates||[]).some(t=>!(previous?.routineTemplates||[]).some(o=>JSON.stringify(t)===JSON.stringify(o))))return 'Salvar seus próprios modelos de rotina faz parte do Pro.';return null;}
export type RoutineLibraryTemplate={
  id:string;category:'Dia a dia'|'Estudos e trabalho'|'Saúde e treino'|'Casa e finanças';
  name:string;description:string;items:{title:string;time:string}[];
};
export const routineLibrary:RoutineLibraryTemplate[]=[
  {id:'morning',category:'Dia a dia',name:'Manhã com organização',
   description:'Uma sequência de início de dia com tempo para prioridades, alimentação e pausas.',
   items:[
    {time:'07:00',title:'Acordar e beber água'},
    {time:'07:10',title:'Higiene pessoal e arrumar a cama'},
    {time:'07:25',title:'Alongamento leve ou caminhada curta'},
    {time:'07:40',title:'Preparar e tomar café da manhã'},
    {time:'08:00',title:'Revisar agenda e compromissos'},
    {time:'08:10',title:'Escolher até três prioridades do dia'},
    {time:'08:20',title:'Organizar ambiente e materiais'},
    {time:'08:30',title:'Começar a primeira tarefa importante'}]},
  {id:'study',category:'Estudos e trabalho',name:'Estudos com foco',
   description:'Organize um período de estudos em blocos, com revisão e pausas.',
   items:[
    {time:'08:00',title:'Separar material e definir o objetivo'},
    {time:'08:10',title:'Revisar o conteúdo anterior'},
    {time:'08:25',title:'Estudar o primeiro assunto'},
    {time:'09:10',title:'Fazer uma pausa curta'},
    {time:'09:20',title:'Resolver exercícios práticos'},
    {time:'10:05',title:'Revisar os erros e tirar dúvidas'},
    {time:'10:30',title:'Fazer resumo ou mapa de revisão'},
    {time:'10:50',title:'Registrar o próximo assunto a estudar'}]},
  {id:'money',category:'Casa e finanças',name:'Finanças em dia',
   description:'Um roteiro para registrar gastos, acompanhar contas e planejar o mês.',
   items:[
    {time:'18:00',title:'Conferir saldo e movimentações'},
    {time:'18:10',title:'Registrar ganhos e gastos recentes'},
    {time:'18:20',title:'Separar despesas fixas e variáveis'},
    {time:'18:30',title:'Verificar contas próximas do vencimento'},
    {time:'18:40',title:'Revisar o orçamento do mês'},
    {time:'18:50',title:'Definir um limite para gastos não essenciais'},
    {time:'19:00',title:'Anotar metas e reservas'},
    {time:'19:10',title:'Planejar a próxima revisão financeira'}]},
  {id:'closing',category:'Dia a dia',name:'Fechamento do dia',
   description:'Finalize pendências e prepare o dia seguinte sem excesso de tarefas.',
   items:[
    {time:'19:30',title:'Revisar tarefas concluídas'},
    {time:'19:40',title:'Reorganizar pendências importantes'},
    {time:'19:50',title:'Registrar gastos ainda não anotados'},
    {time:'20:00',title:'Conferir compromissos de amanhã'},
    {time:'20:10',title:'Preparar roupas e materiais necessários'},
    {time:'20:25',title:'Organizar o espaço para o próximo dia'},
    {time:'20:40',title:'Reservar um momento de descanso'},
    {time:'21:00',title:'Desligar distrações e preparar o sono'}]},
  {id:'work',category:'Estudos e trabalho',name:'Trabalho produtivo',
   description:'Prioridades, blocos de concentração e acompanhamento de entregas.',
   items:[
    {time:'08:30',title:'Revisar compromissos e prazos'},
    {time:'08:40',title:'Definir a entrega mais importante'},
    {time:'09:00',title:'Trabalhar no primeiro bloco de foco'},
    {time:'10:15',title:'Fazer uma pausa e se movimentar'},
    {time:'10:30',title:'Responder mensagens prioritárias'},
    {time:'11:00',title:'Retomar uma tarefa importante'},
    {time:'13:30',title:'Acompanhar projetos e pendências'},
    {time:'15:00',title:'Revisar o andamento das entregas'},
    {time:'16:45',title:'Organizar prioridades para amanhã'}]},
  {id:'home',category:'Casa e finanças',name:'Casa organizada',
   description:'Pequenos blocos para limpeza e organização sem concentrar tudo de uma vez.',
   items:[
    {time:'09:00',title:'Ventilar os ambientes e arrumar camas'},
    {time:'09:15',title:'Recolher objetos fora do lugar'},
    {time:'09:30',title:'Separar roupas para lavar'},
    {time:'10:00',title:'Limpar superfícies de uso frequente'},
    {time:'10:30',title:'Organizar cozinha e louça'},
    {time:'11:00',title:'Verificar lixo e reciclagem'},
    {time:'11:15',title:'Conferir itens de limpeza e compras'},
    {time:'11:30',title:'Revisar o que ficou para outro dia'}]},
  {id:'training-strength',category:'Saúde e treino',name:'Treino de força',
   description:'Planejamento de sessão com aquecimento, exercícios e recuperação; ajuste cargas ao seu nível.',
   items:[
    {time:'17:30',title:'Separar roupas, água e equipamentos'},
    {time:'17:40',title:'Aquecimento leve por 5 a 10 minutos'},
    {time:'17:50',title:'Mobilidade das articulações envolvidas'},
    {time:'18:00',title:'Agachamento ou variação adaptada'},
    {time:'18:15',title:'Empurrar: flexão ou supino adaptado'},
    {time:'18:30',title:'Puxar: remada ou variação adaptada'},
    {time:'18:45',title:'Exercício de core com controle'},
    {time:'19:00',title:'Desacelerar e respirar'},
    {time:'19:10',title:'Registrar exercícios, cargas e observações'}]},
  {id:'training-cardio',category:'Saúde e treino',name:'Caminhada ou cardio',
   description:'Uma sessão flexível de movimento com preparação, ritmo confortável e registro.',
   items:[
    {time:'07:00',title:'Verificar condições e separar água'},
    {time:'07:10',title:'Calçar tênis e preparar o percurso'},
    {time:'07:15',title:'Aquecimento com caminhada leve'},
    {time:'07:25',title:'Caminhar ou pedalar em ritmo confortável'},
    {time:'07:40',title:'Ajustar o ritmo conforme disposição'},
    {time:'07:50',title:'Reduzir o ritmo gradualmente'},
    {time:'08:00',title:'Alongar suavemente se desejar'},
    {time:'08:10',title:'Anotar duração e como se sentiu'}]},
  {id:'training-mobility',category:'Saúde e treino',name:'Mobilidade e recuperação',
   description:'Para dias leves: movimento sem pressa, pausas e observação do próprio corpo.',
   items:[
    {time:'18:00',title:'Preparar um espaço livre e confortável'},
    {time:'18:05',title:'Respirar com calma por alguns minutos'},
    {time:'18:10',title:'Mobilizar ombros e braços sem dor'},
    {time:'18:15',title:'Mobilizar quadris e tornozelos'},
    {time:'18:20',title:'Movimentos leves de coluna e pescoço'},
    {time:'18:25',title:'Caminhada curta ou movimento confortável'},
    {time:'18:35',title:'Pausa para hidratação e descanso'},
    {time:'18:40',title:'Registrar disposição e observações'}]},
  {id:'training-activity',category:'Saúde e treino',name:'Dia ativo com treino',
   description:'Integre exercício, refeições, hidratação e compromissos à rotina sem exageros.',
   items:[
    {time:'07:00',title:'Acordar, beber água e organizar o dia'},
    {time:'07:30',title:'Preparar café da manhã'},
    {time:'08:00',title:'Revisar compromissos importantes'},
    {time:'12:30',title:'Pausa para refeição e descanso'},
    {time:'16:30',title:'Preparar bolsa e roupas de treino'},
    {time:'17:00',title:'Fazer aquecimento antes do treino'},
    {time:'17:15',title:'Realizar treino previsto para o dia'},
    {time:'18:10',title:'Desacelerar, hidratar e descansar'},
    {time:'19:30',title:'Organizar refeições e tarefas restantes'},
    {time:'21:30',title:'Preparar o sono e recuperar as energias'}]},
  {id:'weekend',category:'Dia a dia',name:'Fim de semana equilibrado',
   description:'Uma programação flexível que reserva espaço para descanso e assuntos pessoais.',
   items:[
    {time:'09:00',title:'Acordar sem pressa e tomar café'},
    {time:'09:30',title:'Fazer uma caminhada ou atividade agradável'},
    {time:'10:30',title:'Organizar uma pequena pendência'},
    {time:'11:30',title:'Revisar compras ou compromissos'},
    {time:'13:00',title:'Reservar tempo para amigos ou família'},
    {time:'15:00',title:'Praticar hobby ou atividade de lazer'},
    {time:'18:00',title:'Planejar o início da próxima semana'},
    {time:'19:00',title:'Descansar e aproveitar o tempo livre'}]},
  {id:'exam',category:'Estudos e trabalho',name:'Preparação para provas',
   description:'Um plano de revisão com teoria, questões e acompanhamento dos pontos fracos.',
   items:[
    {time:'08:00',title:'Definir a matéria e a meta do dia'},
    {time:'08:15',title:'Revisar conceitos mais importantes'},
    {time:'09:00',title:'Resolver questões da matéria'},
    {time:'09:50',title:'Fazer uma pausa'},
    {time:'10:05',title:'Analisar erros e lacunas'},
    {time:'10:35',title:'Treinar exercícios mais difíceis'},
    {time:'11:10',title:'Atualizar resumo ou fichas de revisão'},
    {time:'11:30',title:'Registrar progresso e próxima revisão'}]}
];
