// Inspeciona apenas contagens de eventos no D1 isolado de homologação.
// Não consulta nem exibe IDs de usuários, pagadores, pagamentos ou credenciais.
const e=process.env;
const valid=/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
if(e.ASAAS_MODE!=='sandbox'||!valid.test(e.SANDBOX_D1_DATABASE_ID||'')||
 e.SANDBOX_D1_DATABASE_ID===e.PRODUCTION_D1_DATABASE_ID||
 !e.CLOUDFLARE_ACCOUNT_ID||!e.CLOUDFLARE_API_TOKEN)
 throw Error('Ambiente isolado não validado. Consulta não executada.');
const url='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(e.CLOUDFLARE_ACCOUNT_ID)+
 '/d1/database/'+encodeURIComponent(e.SANDBOX_D1_DATABASE_ID)+'/query';
const sql=`SELECT event_type,CASE
 WHEN event_id LIKE 'evt_mr_%' OR event_id LIKE 'evt_card_%' THEN 'simulado'
 ELSE 'provedor_ou_outro' END AS origin,
 COUNT(*) AS total
 FROM asaas_webhook_events GROUP BY event_type,origin ORDER BY event_type,origin`;
const response=await fetch(url,{method:'POST',
 headers:{Authorization:'Bearer '+e.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},
 body:JSON.stringify({sql,params:[]}),signal:AbortSignal.timeout(25000)});
if(!response.ok)throw Error('D1 não respondeu à consulta de auditoria: HTTP '+response.status);
const result=await response.json();
const rows=result.result?.[0]?.results;
if(!result.success||!Array.isArray(rows))throw Error('Falha na consulta da tabela de eventos do D1.');
console.log('Eventos registrados no D1 Sandbox (somente contagens): '+JSON.stringify(rows));
console.log('ATENÇÃO: os IDs classificados como provedor_ou_outro podem incluir testes manuais externos; os dados não comprovam autenticação do remetente.');
