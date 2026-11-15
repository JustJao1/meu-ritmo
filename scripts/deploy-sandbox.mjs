import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const name='meu-ritmo-asaas-sandbox';
const required=[
 'CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN',
 'SANDBOX_D1_DATABASE_ID','PRODUCTION_D1_DATABASE_ID',
 'SANDBOX_SUPABASE_URL','PRODUCTION_SUPABASE_URL',
 'SANDBOX_SUPABASE_PUBLISHABLE_KEY','SANDBOX_SESSION_ENCRYPTION_KEY',
 'ASAAS_API_KEY'
];
for(const key of required)if(!process.env[key])throw Error('Falta configurar '+key+' antes de publicar homologação.');
const staging=process.env.SANDBOX_D1_DATABASE_ID;
const production=process.env.PRODUCTION_D1_DATABASE_ID;
if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(staging)||
 staging==='00000000-0000-4000-8000-000000000000'||
 staging.toLowerCase()===production.toLowerCase())
 throw Error('O D1 de testes precisa ter um ID real e diferente do banco de produção.');
const sandboxUrl=new URL(process.env.SANDBOX_SUPABASE_URL);
const productionUrl=new URL(process.env.PRODUCTION_SUPABASE_URL);
if(sandboxUrl.protocol!=='https:'||productionUrl.protocol!=='https:'||
 sandboxUrl.origin===productionUrl.origin||
 !sandboxUrl.hostname.endsWith('.supabase.co'))
 throw Error('Configure um projeto Supabase de testes separado do de produção.');
if(process.env.SANDBOX_SESSION_ENCRYPTION_KEY===process.env.PRODUCTION_SESSION_ENCRYPTION_KEY)
 throw Error('A chave de sessão de homologação deve ser diferente da de produção.');
if(process.env.ASAAS_MODE!=='sandbox'||!process.env.ASAAS_API_KEY.startsWith('$aact_hmlg_'))
 throw Error('Publicação bloqueada: utilize somente chave e ambiente Asaas Sandbox.');
if(!['true','false'].includes(process.env.ASAAS_WEBHOOK_READY||'false')||
 !['true','false'].includes(process.env.ASAAS_BILLING_ENABLED||'false'))
 throw Error('Variáveis de ativação da homologação inválidas.');
if(process.env.ASAAS_BILLING_ENABLED==='true'&&
 (process.env.ASAAS_WEBHOOK_READY!=='true'||!process.env.ASAAS_WEBHOOK_TOKEN))
 throw Error('Não habilite checkout de testes antes de configurar o webhook do Sandbox.');

const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
config.name=name;
config.workers_dev=true;
config.d1_databases[0].database_name=name;
config.d1_databases[0].database_id=staging;
await writeFile('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
const run=(args,input)=>{
 const result=spawnSync(process.execPath,args,{
  stdio:input?['pipe','inherit','inherit']:'inherit',
  input,env:process.env
 });
 if(result.status!==0)process.exit(result.status||1);
};
run(['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--remote']);
run(['node_modules/vinext/dist/cli.js','build']);
// Reinforce the isolated Worker name and D1 binding even if the build regenerated config.
const generatedPath='dist/server/wrangler.json';
const generated=JSON.parse(await readFile(generatedPath,'utf8'));
generated.name=name;
if(!generated.d1_databases?.some(db=>db.binding==='DB'))
 throw Error('O build não gerou o binding D1 esperado.');
generated.d1_databases=generated.d1_databases.map(db=>db.binding==='DB'
 ?{...db,database_name:name,database_id:staging}:db);
await writeFile(generatedPath,JSON.stringify(generated,null,2)+'\n');
run(['node_modules/wrangler/bin/wrangler.js','deploy','--config',generatedPath]);
const values={
 EARLY_ACCESS_ENABLED:'false',
 SUPABASE_URL:process.env.SANDBOX_SUPABASE_URL,
 SUPABASE_PUBLISHABLE_KEY:process.env.SANDBOX_SUPABASE_PUBLISHABLE_KEY,
 SESSION_ENCRYPTION_KEY:process.env.SANDBOX_SESSION_ENCRYPTION_KEY,
 ASAAS_API_KEY:process.env.ASAAS_API_KEY,
 ASAAS_MODE:'sandbox',
 ASAAS_WEBHOOK_READY:process.env.ASAAS_WEBHOOK_READY||'false',
 ASAAS_BILLING_ENABLED:process.env.ASAAS_BILLING_ENABLED||'false'
};
if(process.env.SANDBOX_SUPABASE_SERVICE_ROLE_KEY)
 values.SUPABASE_SERVICE_ROLE_KEY=process.env.SANDBOX_SUPABASE_SERVICE_ROLE_KEY;
if(process.env.ASAAS_WEBHOOK_TOKEN)
 values.ASAAS_WEBHOOK_TOKEN=process.env.ASAAS_WEBHOOK_TOKEN;
run(['node_modules/wrangler/bin/wrangler.js','secret','bulk','--name',name],JSON.stringify(values));
console.log('Homologação publicada em um Worker e banco D1 próprios. A produção não foi modificada.');
