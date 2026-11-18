import type {Locale} from '../components/language-selector';

/** Notas editoriais completas. Nenhum texto é montado combinando frases aleatórias. */
const notes:Record<Locale,readonly string[]>={
 'pt-BR':[
  'Confira a agenda antes de começar a primeira tarefa.',
  'Se um compromisso mudou, atualize o horário para não se perder depois.',
  'Escolha uma tarefa importante e deixe as outras em ordem de prioridade.',
  'Anote os gastos pequenos também. Eles fazem diferença na soma do mês.',
  'Revise as contas com vencimento próximo antes de planejar outros gastos.',
  'Quando lembrar de algo, registre em uma nota e volte ao que estava fazendo.',
  'Uma lista de compras organizada evita ter que voltar ao mercado.',
  'Marque as tarefas concluídas para enxergar o que ainda está pendente.',
  'Separe um horário livre entre compromissos que exigem deslocamento.',
  'Se o dia ficou cheio, mova uma tarefa menos urgente para outra data.',
  'Confira os compromissos de amanhã antes de encerrar o dia.',
  'Um orçamento funciona melhor quando os valores estão atualizados.',
  'Organize as notas por assunto para encontrá-las com facilidade.',
  'Se compartilhar uma rotina, confira os horários antes de publicar.',
  'Reserve algum tempo da agenda para descansar sem outras tarefas.',
  'Reveja as pendências da semana antes de assumir um novo compromisso.'
 ],
 en:[
  'Check your calendar before starting your first task.',
  'If an appointment changes, update the time so it stays accurate.',
  'Choose one important task and put the others in priority order.',
  'Record small expenses too. They add up over the month.',
  'Check upcoming bills before planning other expenses.',
  'When an idea comes up, add a note and return to what you were doing.',
  'A shopping list can save you an extra trip.',
  'Check off completed tasks to see what is still pending.',
  'Leave a little travel time between appointments.',
  'If today is full, move a less urgent task to another date.',
  'Check tomorrow’s calendar before wrapping up the day.',
  'A budget is more useful when its numbers are up to date.',
  'Group your notes by subject so you can find them later.',
  'Before sharing a routine, double-check its times.',
  'Leave some room on your calendar for rest.',
  'Review this week’s pending tasks before taking on something else.'
 ],
 es:[
  'Revisa tu agenda antes de empezar la primera tarea.',
  'Si cambia una cita, actualiza la hora para no confundirte después.',
  'Elige una tarea importante y ordena las demás por prioridad.',
  'Anota también los gastos pequeños. Se acumulan a lo largo del mes.',
  'Revisa las facturas próximas a vencer antes de planear otros gastos.',
  'Cuando se te ocurra algo, apúntalo y vuelve a lo que estabas haciendo.',
  'Una lista de compras puede evitarte otro viaje a la tienda.',
  'Marca las tareas terminadas para ver cuáles siguen pendientes.',
  'Deja tiempo para desplazarte entre compromisos.',
  'Si hoy tienes demasiadas cosas, pasa una tarea menos urgente a otra fecha.',
  'Revisa la agenda de mañana antes de terminar el día.',
  'Un presupuesto sirve más cuando sus cantidades están al día.',
  'Agrupa tus notas por tema para encontrarlas después.',
  'Antes de compartir una rutina, comprueba sus horarios.',
  'Reserva un momento de la agenda para descansar.',
  'Revisa las tareas pendientes de la semana antes de asumir otra cosa.'
 ]
};

export function dailyMotivation(dateKey:string,locale:Locale):string{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dateKey))return '';
 const [y,m,d]=dateKey.split('-').map(Number);
 const date=new Date(Date.UTC(y,m-1,d,12));
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==dateKey)return '';
 const day=Math.floor(date.getTime()/86400000);
 const language=notes[locale]||notes['pt-BR'];
 const when=new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date);
 const prefix=locale==='en'?'For':locale==='es'?'Para el':'Para';
 return `${prefix} ${when}, ${language[((day%language.length)+language.length)%language.length]}`;
}

export function capitalizeMotivation(value:string,locale:Locale):string{
 return value.replace(/\p{L}/u,letter=>letter.toLocaleUpperCase(locale));
}
