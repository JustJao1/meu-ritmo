import {SunMedium,CalendarDays,Wallet,NotebookPen,ListChecks,UsersRound,Ticket,ShieldCheck,Smartphone,MessageSquareText,Bell,BookOpen,Paintbrush,Settings2,type LucideIcon} from 'lucide-react';

type Props={name:string;size?:number};
const icons:Record<string,LucideIcon>={
 'Hoje':SunMedium,
 'Agenda':CalendarDays,
 'Gastos':Wallet,
 'Notas':NotebookPen,
 'Rotina':ListChecks,
 'Comunidade':UsersRound,
 'Planos':Ticket,
 'Administração':ShieldCheck,
 'Meu Ritmo App':Smartphone,
 'Atendimento':MessageSquareText,
 'Opiniões e respostas':MessageSquareText,
 'Alarmes e lembretes':Bell,
 'Guia e ajuda':BookOpen,
 'Meu estilo':Paintbrush,
 'Configurações':Settings2,
};
const aliases:Record<string,string>={'Contas':'Comunidade','Administradores':'Administração','Códigos':'Planos','Acessos':'Planos','Opiniões':'Opiniões e respostas','Histórico':'Notas','Descontos':'Planos','Moderação':'Administração','Lançamento':'Rotina','Cobranças':'Gastos'};

/** Outline icons share one stroke, never embed theme-colored rectangles inside SVG. */
export default function CategoryIllustration({name,size=24}:Props){
 const Icon=icons[name]||icons[aliases[name]]||ShieldCheck;
 return <Icon className="category-illustration" size={size} strokeWidth={1.75} aria-hidden="true" focusable="false"/>;
}
