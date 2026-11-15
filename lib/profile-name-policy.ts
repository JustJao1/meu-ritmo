/**
 * Public profile-name policy. Kept intentionally conservative to avoid
 * rejecting ordinary names that contain innocent substrings.
 */
const banned=new Set([
  'fdp','pqp','puta','puto','putaria','putinha','caralho','porra',
  'merda','foda','foder','fodase','buceta','xota','arrombado',
  'arrombada','cuzao','cuzona','filhodaputa','filhadaputa',
  'pedofilo','pedofila','pedofilia','estuprador','estupradora',
  'nazista','neonazi','racista','racismo','idiota','imbecil',
  'vagabundo','vagabunda','asshole','motherfucker','fuckyou',
  'bitch','bastard','mierda','pendejo','pendeja','chingada'
]);
const serious=['pedofil','estupr','neonazi','filhodaputa','filhadaputa','motherfucker','pornograf','pornhub','racist','fuckyou','heilhitler'];
const official=new Set([
  'admin','administrador','administradora','administrator','moderador',
  'moderadora','moderator','suporte','support','atendimento','equipe',
  'staff','official','oficial','meuritmo','meuritmoadmin','mradmin',
  'root','system','sistema','seguranca','security','verificado',
  'verified','helpdesk'
]);
function fold(value:string){
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g,'');
}
function tokens(value:string):string[]{
  const words=value.replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(Boolean);
  return words.length>1&&words.every(word=>word.length===1)
    ? [...words,words.join('')] : words;
}
export function nameIssue(value:string,kind:'username'|'display'):'inappropriate'|'impersonation'|null{
  const raw=fold(value.trim());
  const leet=raw.replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e')
    .replace(/4/g,'a').replace(/5/g,'s').replace(/7/g,'t')
    .replace(/@/g,'a').replace(/\$/g,'s').replace(/!/g,'i');
  if(kind==='display'&&/(?:^|[^a-z])(?:meu[\s_-]*ritmo|mr[\s_-]*(?:oficial|suporte|admin)|(?:suporte|atendimento)[\s_-]*meu[\s_-]*ritmo)(?:$|[^a-z])/.test(raw))
    return 'impersonation';
  const candidates=[...tokens(raw),...tokens(leet)];
  const all=[...candidates,...candidates.map(w=>w.replace(/\d+$/,''))];
  if(all.some(w=>official.has(w)))return 'impersonation';
  if(all.some(w=>banned.has(w)))return 'inappropriate';
  const compact=leet.replace(/[^a-z]/g,'');
  if(serious.some(part=>compact.includes(part)))return 'inappropriate';
  return null;
}
