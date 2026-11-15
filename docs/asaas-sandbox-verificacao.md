# Verificação do Asaas Sandbox

O workflow **Verificar Asaas Sandbox** é manual e apenas testa autenticação por uma leitura de clientes.

- Não publica Worker, não toca no banco D1 e não cria cobranças.
- Usa o ambiente GitHub **sandbox**, cujo Secret `ASAAS_API_KEY` deve ser a chave de testes iniciada por `$aact_hmlg_`.
- Requer a variável de ambiente `ASAAS_MODE=sandbox`.
- Recusa execução se a chave estiver ausente ou for diferente de uma chave nova do Sandbox, mesmo que haja chave de Produção com o mesmo nome nos Secrets do repositório.
- Envia somente GET para `https://api-sandbox.asaas.com/v3/customers?limit=1`.
- Não imprime chave, resposta de clientes nem informações pessoais.

Para executar: **GitHub → Actions → Verificar Asaas Sandbox → Run workflow → main**.

Esse teste não homologa o fluxo completo de assinatura ou webhook. Para simular pagamentos de ponta a ponta será necessário um backend de testes separado, incluindo Worker, banco D1, autenticação e webhook de Sandbox, sem compartilhar dados ou credenciais de produção. O workflow **Publicar Meu Ritmo** continua exclusivamente em `production`.
