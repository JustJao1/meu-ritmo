# Integração Asaas — implementação em andamento

Esta branch prepara a substituição do Stripe pelo Asaas. **Ainda não está pronta para produção**; não abra o checkout enquanto não houver testes de ponta a ponta.

## Ambiente

- `ASAAS_API_KEY`: chave privada guardada como Secret do Worker.
- `ASAAS_MODE=sandbox` (padrão) ou `production`.
- `ASAAS_BILLING_ENABLED=false` (padrão).
- `ASAAS_WEBHOOK_TOKEN`: token *diferente* da chave de API, com 32–255 caracteres sem espaços.
- `ASAAS_WEBHOOK_READY=false` (padrão). Só marcar `true` após validar webhook, persistência e reconciliação.

**Atenção:** a chave de produção não funciona no Sandbox. Criar credenciais Sandbox separadas para testes. A existência de `ASAAS_API_KEY` não habilita cobrança.

## Escopo dos métodos

A API de cobrança suporta `UNDEFINED`, `PIX`, `BOLETO` e `CREDIT_CARD`. Com `UNDEFINED`, o pagador escolhe os meios habilitados na fatura Asaas. Cartão de débito e TED constam entre serviços Asaas, mas **não** como modalidades de `POST /v3/payments`; não anunciar essas modalidades como opções diretas de checkout. Pix Automático usa fluxo de autorização separado; não confundir com assinatura Pix comum. 

## Trabalho obrigatório antes do deploy

1. Fazer migração de dados que diferencie IDs Asaas dos antigos IDs Stripe, sem invalidar contas pré-existentes.
2. Implementar checkout autenticado com formulário de dados obrigatórios do pagador (CPF/CNPJ, nome), consentimento e proteção contra chamadas repetidas, além de seleção de Pix, boleto e cartão.
3. Cadastrar cliente de maneira idempotente e persistir referência do pagamento/assinatura antes de finalizar resposta.
4. Configurar webhook com `authToken`; validar header `asaas-access-token` antes de processar.
5. Persistir `event.id` para deduplicação e cruzar evento com a cobrança consultada de volta pela API; nunca ativar plano só por retorno de checkout.
6. Calcular o período contratado e liberar acesso apenas após pagamento confirmado. Tratar atrasos, estornos, cancelamentos, trocas de plano e múltiplos ciclos.
7. Implantar gerenciamento e histórico de pagamentos; adaptar a interface de assinatura do site e APK.
8. Criar testes automáticos (sem dinheiro real) e validar os fluxos em Sandbox antes de habilitar produção.
9. Revisar o script `scripts/deploy.mjs` para garantir que publicação futura **não apague** segredos do Worker.
10. Só então ativar `ASAAS_BILLING_ENABLED=true` e `ASAAS_WEBHOOK_READY=true` num deploy aprovado.

Referências oficiais:
- https://docs.asaas.com/reference/criar-nova-cobranca
- https://docs.asaas.com/reference/criar-nova-assinatura
- https://docs.asaas.com/docs/pix-automatico
- https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook
