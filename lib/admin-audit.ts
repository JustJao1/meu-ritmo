/**
 * Presentation metadata for the append-only administrative activity log.
 * The server supplies the facts; these descriptions never infer an event.
 */
export type AuditGroup='access'|'codes'|'community'|'settings'|'other';
export type AuditEntry={
 actor_email:string;
 action:string;
 target:string;
 details:string;
 created_at:number;
};
export type AuditDefinition={label:string;group:AuditGroup};

const definitions:Record<string,AuditDefinition>={
 admin_added:{label:'Administrador adicionado',group:'access'},
 admin_removed:{label:'Administrador removido',group:'access'},
 plan_granted:{label:'Plano concedido',group:'access'},
 grant_revoked:{label:'Acesso revogado',group:'access'},
 promo_created:{label:'Código promocional criado',group:'codes'},
 promo_enabled:{label:'Código promocional reativado',group:'codes'},
 promo_disabled:{label:'Código promocional desativado',group:'codes'},
 promo_redeemed:{label:'Código promocional resgatado',group:'codes'},
 discount_created:{label:'Cupom de desconto criado',group:'codes'},
 discount_enabled:{label:'Cupom de desconto reativado',group:'codes'},
 discount_disabled:{label:'Cupom de desconto desativado',group:'codes'},
 social_removed:{label:'Conteúdo removido da comunidade',group:'community'},
 social_suspended:{label:'Perfil suspenso da comunidade',group:'community'},
 social_restored:{label:'Participação na comunidade restaurada',group:'community'},
 report_resolved:{label:'Denúncia analisada',group:'community'},
 legal_updated:{label:'Dados do responsável atualizados',group:'settings'},
 privacy_resolved:{label:'Solicitação de privacidade concluída',group:'settings'}
};
export function auditDefinition(action:string):AuditDefinition{
 return definitions[action]||{label:'Outra alteração registrada',group:'other'};
}
export function auditDetails(value:unknown):Record<string,unknown>{
 if(typeof value!=='string'||value.length>12000)return {};
 try{
  const parsed:unknown=JSON.parse(value);
  return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{};
 }catch{return {};}
}
export function auditTarget(target:string,action:string):{text:string;isTechnical:boolean}{
 if(action==='legal_updated'&&target==='service')return {text:'Identificação do serviço',isTechnical:false};
 if(/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(target))return {text:'Registro '+target.slice(0,8).toUpperCase(),isTechnical:true};
 return {text:target||'Sem referência',isTechnical:false};
}
export function auditDetailFields(details:Record<string,unknown>){
 const fieldNames:Record<string,string>={
  reason:'Motivo',label:'Campanha',plan:'Plano',days:'Dias de acesso',
  kind:'Tipo de conteúdo',maxUses:'Limite de resgates',
  expiresAt:'Vencimento do código',value:'Valor configurado',
  grantId:'Identificador do benefício',id:'Identificador da concessão'
 };
 return Object.entries(fieldNames).flatMap(([key,label])=>{
  const value=details[key];
  if(value===null||value===undefined||value===''||typeof value==='object')return [];
  if(typeof value!=='string'&&typeof value!=='number'&&typeof value!=='boolean')return [];
  return [{key,label,value:String(value).slice(0,500)}];
 });
}
