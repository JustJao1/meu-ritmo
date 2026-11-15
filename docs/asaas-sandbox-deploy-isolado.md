# Homologação isolada do Asaas no Meu Ritmo

O workflow manual `Publicar Meu Ritmo Sandbox (isolado)` publica um segundo Worker chamado `meu-ritmo-asaas-sandbox`, com seu próprio banco D1 e projeto Supabase de testes. Não utiliza o domínio `meuritmo.net`. O workflow oficial `Publicar Meu Ritmo` continua exclusivamente em produção.

## Antes de executar o novo workflow

### 1. Banco D1 exclusivo de testes

No painel Cloudflare, abra **Workers & Pages → D1 SQL Database → Create database** e crie o banco `meu-ritmo-asaas-sandbox`. Copie o ID UUID do banco.

No GitHub, abra **Settings → Environments → sandbox → Environment variables** e cadastre:

- `SANDBOX_D1_DATABASE_ID` = UUID do novo D1, **não o banco já usado pelo site principal**.
- `ASAAS_MODE` = `sandbox` (já cadastrada).
- `ASAAS_WEBHOOK_READY` = `false`.
- `ASAAS_BILLING_ENABLED` = `false`.

O script bloqueia a implantação se o UUID do D1 for idêntico ao de produção.

### 2. Projeto Supabase exclusivo de testes

Crie um projeto Supabase separado, com autenticação por e-mail. Em **GitHub → Settings → Environments → sandbox → Environment secrets**, cadastre:

- `SANDBOX_SUPABASE_URL`: URL do **novo** projeto (diferente da produção).
- `SANDBOX_SUPABASE_PUBLISHABLE_KEY`: chave publicável desse projeto de testes.
- `SANDBOX_SESSION_ENCRYPTION_KEY`: segredo aleatório com 32 bytes ou mais de entropia, diferente do segredo de produção. Gere localmente com `openssl rand -base64 32`.
- `ASAAS_API_KEY`: chave **do Asaas Sandbox** que já foi cadastrada.

Opcionalmente, use `SANDBOX_SUPABASE_SERVICE_ROLE_KEY` **somente com a chave service-role do projeto de testes** para validar exclusão de conta.

Não copie URL, chaves privilegiadas, sessão, bancos ou usuários de produção. Configure o callback / Site URL do projeto Supabase de testes para o endereço do Worker Sandbox depois da primeira publicação. Sem isso, o login poderá exigir ajustes.

### 3. Publicação separada

No GitHub, execute manualmente **Actions → Publicar Meu Ritmo Sandbox (isolado) → Run workflow → main**. A implantação somente ocorrerá se as validações de isolamento passarem.

O Worker de teste será publicado em um domínio `*.workers.dev` gerenciado pela Cloudflare, sem interferir no domínio principal. A URL exata aparecerá no log do GitHub Actions.

### 4. Webhook Sandbox e simulações

No painel do **Asaas Sandbox**, crie outro webhook, diferente do webhook já configurado em produção:

- URL: `https://<endereço-real-do-worker-sandbox>/api/billing/webhook/asaas`.
- API: v3; entrega sequencial; fila ativa; eventos de cobranças.
- Token distinto de produção.

Cadastre esse token no ambiente `sandbox` como Secret `SANDBOX_ASAAS_WEBHOOK_TOKEN`. O workflow o fornecerá internamente ao Worker com o nome `ASAAS_WEBHOOK_TOKEN`, sem reaproveitar o token de produção. Depois de confirmar que o endereço de testes está publicado e o token coincide, mude `ASAAS_WEBHOOK_READY=true` e publique de novo **apenas o workflow Sandbox**.

Para permitir simular contratações na homologação, altere `ASAAS_BILLING_ENABLED=true` **somente no ambiente sandbox**, publique o Worker de teste, e execute as operações Pix e cartão no Asaas Sandbox.

Os planos devem permanecer pendentes até confirmação via webhook. Teste também renovação, cupom, cancelamento, duplicação de eventos e estorno. Nunca utilize a chave de produção nos testes. Mesmo no Sandbox, use somente usuários e documentos fictícios fornecidos para testes pelo provedor.

O workflow de homologação não roda automaticamente. Em caso de dúvida sobre nomes de bancos ou chaves, interrompa a execução e confira o ambiente antes de tentar novamente.
