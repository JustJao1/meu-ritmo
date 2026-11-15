import type {Locale} from '../components/language-selector';

const prompts:Record<Locale,{lead:string;starts:string[];ends:string[]}>={
  'pt-BR':{
    lead:'Para',
    starts:[
      'um pequeno passo já merece atenção.',
      'começar é mais importante que acertar tudo.',
      'o que cabe no seu dia já é suficiente.',
      'organizar uma coisa pode trazer clareza ao resto.',
      'um plano simples também ajuda a avançar.',
      'você pode mudar o ritmo sem abandonar o caminho.',
      'há valor em concluir o que estava pendente.',
      'escolher uma prioridade já é progresso.',
      'o descanso também faz parte dos planos.',
      'um dia mais leve começa com escolhas possíveis.',
      'cada compromisso concluído abre espaço para o próximo.'
    ],
    ends:[
      'Dê atenção ao próximo passo.',
      'Faça o possível, no seu tempo.',
      'O importante é seguir com intenção.',
      'O resto pode esperar um pouco.',
      'Você não precisa resolver tudo de uma vez.',
      'Comece pelo que está ao seu alcance.',
      'Reconheça também as pequenas conquistas.',
      'Ajustar os planos faz parte.',
      'Guarde energia para o que realmente importa.',
      'Deixe espaço para respirar.'
    ]
  },
  en:{
    lead:'For',
    starts:[
      'a small step is still worth noticing.',
      'starting matters more than getting everything right.',
      'what fits into today is enough.',
      'organizing one thing can make the rest clearer.',
      'a simple plan can help you move forward.',
      'you can change your pace without losing direction.',
      'there is value in finishing what you started.',
      'choosing a priority is progress.',
      'rest belongs in the plan, too.',
      'a lighter day begins with realistic choices.',
      'each finished task makes room for the next.'
    ],
    ends:[
      'Focus on the next step.',
      'Do what you can at your own pace.',
      'Keep moving with intention.',
      'The rest can wait a little.',
      'You do not need to solve everything at once.',
      'Start with what is within reach.',
      'Notice the small wins as well.',
      'Adjusting your plans is part of it.',
      'Save energy for what matters.',
      'Leave room to breathe.'
    ]
  },
  es:{
    lead:'Para el',
    starts:[
      'un pequeño paso también merece atención.',
      'empezar importa más que hacerlo todo perfecto.',
      'lo que cabe en tu día es suficiente.',
      'organizar una cosa puede aclarar las demás.',
      'un plan sencillo también ayuda a avanzar.',
      'puedes cambiar el ritmo sin perder el rumbo.',
      'terminar lo pendiente también tiene valor.',
      'elegir una prioridad ya es progresar.',
      'el descanso también forma parte del plan.',
      'un día más ligero empieza con decisiones posibles.',
      'cada tarea terminada deja espacio para la siguiente.'
    ],
    ends:[
      'Presta atención al siguiente paso.',
      'Haz lo posible a tu ritmo.',
      'Sigue adelante con intención.',
      'Lo demás puede esperar un poco.',
      'No tienes que resolverlo todo a la vez.',
      'Empieza por lo que tienes a tu alcance.',
      'Reconoce también los pequeños logros.',
      'Ajustar los planes es parte del camino.',
      'Reserva energía para lo importante.',
      'Deja espacio para respirar.'
    ]
  }
};

export function dailyMotivation(dateKey:string,locale:Locale):string{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateKey))return '';
  const [y,m,d]=dateKey.split('-').map(Number);
  const date=new Date(Date.UTC(y,m-1,d,12));
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==dateKey)return '';
  const day=Math.floor(date.getTime()/86400000);
  const {lead,starts,ends}=prompts[locale]||prompts['pt-BR'];
  const when=new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date);
  // The date is part of the message, so its full text never repeats on another day.
  return `${lead} ${when}, ${starts[((day%starts.length)+starts.length)%starts.length]} ${ends[Math.floor(day/starts.length)%ends.length]}`;
}
