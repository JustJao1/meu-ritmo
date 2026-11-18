import QuietIllustration from './quiet-illustration';
export default function ContextIllustration({context}:{context:string}){
 const key=context.toLocaleLowerCase('pt-BR');
 const kind=/administra|modera|permiss|seguran|senha|privacidade|termos/.test(key)?'security'
 :/perfil|contas|membro/.test(key)?'profile'
 :/histórico|auditoria|lançamento/.test(key)?'records'
 :/cobran|gasto|orçamento|excesso|reembolso|pix|relatório/.test(key)?'finance'
 :/assinatura|código|acesso|desconto|plano|benefício|promo/.test(key)?'plans'
 :/opini|respost|comunidade|espaço/.test(key)?'community'
 :/alarme|aviso|lembrete/.test(key)?'alerts'
 :/estilo|configura|crédito/.test(key)?'style'
 :/nota|recado|criar/.test(key)?'notes'
 :/agenda|compromisso/.test(key)?'agenda'
 :/rotina|tarefa|revisar/.test(key)?'routine'
 :/app|aplicativo/.test(key)?'devices':'welcome';
 return <span className="context-illustration"><QuietIllustration kind={kind}/></span>;
}
