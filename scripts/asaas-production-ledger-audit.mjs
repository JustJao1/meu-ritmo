// Auditoria somente de leitura dos pedidos Asaas no D1 comercial.
// Não consulta nomes, CPF, emails, IDs, valores individuais ou segredos.
const e=process.env;
const uuid=/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
if(e.ASAAS_MODE!=='production'||!uuid.test(e.CLOUDFLARE_D1_DATABASE_ID||'')||
 !e.CLOUDFLARE_ACCOUNT_ID||!e.CLOUDFLARE_API_TOKEN)
 throw Error('Auditoria indisponível: credenciais de produção ausentes ou inválidas.');
if(e.SANDBOX_D1_DATABASE_ID&&e.CLOUDFLARE_D1_DATABASE_ID.toLowerCase()===e.SANDBOX_D1_DATABASE_ID.toLowerCase())
 throw Error('Auditoria bloqueada: banco de produção igual ao Sandbox.');
const url='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(e.CLOUDFLARE_ACCOUNT_ID)+
 '/d1/database/'+encodeURIComponent(e.CLOUDFLARE_D1_DATABASE_ID)+'/query';
async function query(sql){
 const r=await fetch(url,{method:'POST',headers:{
  Authorization:'Bearer '+e.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({sql,params:[]}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('D1 comercial não respondeu à auditoria: HTTP '+r.status);
 const d=await r.json();
 if(!d.success||!d.result?.[0]?.success||!Array.isArray(d.result[0].results))
  throw Error('D1 comercial não confirmou a consulta de leitura.');
 return d.result[0].results;
}
const summaries=await query("SELECT status,COUNT(*) AS total FROM asaas_orders GROUP BY status ORDER BY status");
const aging=await query("SELECT COUNT(*) AS total FROM asaas_orders WHERE status IN ('pending','creating') AND created_at<CAST(strftime('%s','now') AS INTEGER)-7200");
const reviews=await query("SELECT COUNT(*) AS total FROM asaas_orders WHERE status='review'");
const hosts=await query("SELECT status,COUNT(*) AS total FROM asaas_hosted_pix_checkouts GROUP BY status ORDER BY status");
const missing=await query("SELECT COUNT(*) AS total FROM asaas_orders o JOIN asaas_hosted_pix_checkouts h ON h.order_id=o.id LEFT JOIN subscriptions s ON s.subscription_id='checkout_'||h.checkout_id AND s.user_id=o.user_id WHERE o.status='active' AND o.first_paid_at IS NOT NULL AND (s.subscription_id IS NULL OR s.valid_until<=o.first_paid_at)");
console.log('Asaas pedidos comerciais (contagens): '+JSON.stringify(summaries));
console.log('Checkouts Pix comerciais (contagens): '+JSON.stringify(hosts));
console.log('Pedidos pendentes há mais de 2 horas: '+Number(aging[0]?.total||0));
console.log('Pedidos para revisão: '+Number(reviews[0]?.total||0));
console.log('Pedidos Pix pagos sem período correspondente: '+Number(missing[0]?.total||0));
if(Number(reviews[0]?.total||0)>0)
 console.warn('::warning title=Revisão de cobranças::Há pedidos comerciais aguardando revisão manual.');
if(Number(aging[0]?.total||0)>0)
 console.warn('::warning title=Pagamentos pendentes::Há pedidos com mais de 2h sem conclusão; verifique no painel Asaas antes de agir.');
if(Number(missing[0]?.total||0)>0)
 console.error('::error title=Conciliação Pix::Há pagamentos registrados como ativos sem período válido correspondente. Conferência urgente.');
console.log('Auditoria de leitura concluída. Nenhuma cobrança, plano ou segredo foi alterado.');
if(Number(missing[0]?.total||0)>0)process.exitCode=1;
