/**
 * Conservative server-side screening for PUBLIC profile identifiers and display names.
 * Rejects clear abuse and impersonation. Context-sensitive cases stay reportable,
 * rather than blocking every substring in ordinary names.
 */
function fold(value:string){
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g,'');
}
const offensiveWords=new Set([
  'fdp','pqp','puta','puto','putaria','putinha','caralho','porra','merda','foda',
  'foder','fodase','buceta','xota','arrombado','arrombada','cuzao','cuzona',
  'filhodaputa','filhadaputa','pedofilo','pedofila','pedofilia','estuprador',
  'estupradora','estuprar','estupramento','nazista','neonazi',
  'racista','racismo','idiota','imbecil','vagabundo','vagabunda',
  'asshole','motherfucker','fuckyou','bitch','bastard',
  'mierda','pendejo','pendeja','chingada','gilipollas'
]);
const dangerousSegments=[
  'pedofil','estupr','neonazi','filhodaputa','filhadaputa','motherfucker',
  'pornograf','pornhub','racist','fuckyou','heilhitler'
];
const reservedWords=new Set([
  'admin','administrador','administradora','administrator','moderador','moderadora','moderator',
  'suporte','support','atendimento','equipe','staff','official','oficial',
  'meuritmo','meuritmoadmin','mradmin','root','system','sistema','seguranca',
  'security','verificado','verified','helpdesk'
]);

export function nameIssue(value:string,kind:'username'|'display'):'inappropriate'|'impersonation'|null {
  const raw=fold(value.trim());
  const leet=raw.replace(/[013457@$!]/g,c=>({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','
  if(each.some(w=>reservedWords.has(w)) || kind==='username'&&raw.split('_').some(w=>reservedWords.has(w.replace(/\d+$/,''))))
    return 'impersonation';
  if(each.some(w=>offensiveWords.has(w)))return 'inappropriate';
  const compact=leet.replace(/[^a-z]/g,'');
  // Detect only distinctive, severe substrings to avoid blocking names
  // like "Computador" because they happen to contain a shorter term.
  if(dangerousSegments.some(w=>compact.includes(w)))return 'inappropriate';
  return null;
}
:'s','!':'i'} as Record<string,string>)[c]||c);
  const tokenize=(s:string)=>{
    const words=s.replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(Boolean);
    const joined=words.length>=2&&words.every(w=>w.length===1)?words.join(''):null;
    return [...words,...(joined?[joined]:[])];
  };
  if(kind==='display'&&/(?:^|[^a-z])(?:meu[\\s_-]*ritmo|mr[\\s_-]*(?:oficial|suporte|admin)|(?:suporte|atendimento)[\\s_-]*meu[\\s_-]*ritmo)(?:$|[^a-z])/.test(raw))return 'impersonation';
  const candidates=[...tokenize(raw),...tokenize(leet)];
  const withNumericSuffix=candidates.map(w=>w.replace(/\d+$/,''));
  const each=[...candidates,...withNumericSuffix];
  if(each.some(w=>reservedWords.has(w)) || kind==='username'&&raw.split('_').some(w=>reservedWords.has(w.replace(/\d+$/,''))))
    return 'impersonation';
  if(each.some(w=>offensiveWords.has(w)))return 'inappropriate';
  const compact=raw.replace(/[^a-z]/g,'');
  // Detect only distinctive, severe substrings to avoid blocking names
  // like "Computador" because they happen to contain a shorter term.
  if(dangerousSegments.some(w=>compact.includes(w)))return 'inappropriate';
  return null;
}
