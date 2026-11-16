# Integração Asaas: ativação controlada do Meu Ritmo

**Durante a homologação, descontos promocionais na primeira cobrança são aceitos apenas com Pix.** A documentação do Asaas exige tokenização para alterar o valor de assinaturas com cartão; só habilite cupom em cartão depois de validar esse requisito e os testes de renovação, sem cobrar o valor errado nem bloquear um benefício pago. <https://docs.asaas.com/reference/atualizar-assinatura-existente>\n\nO checkout oferece **somente Pix ou cartão de crédito**. O cliente escolhe o método antes de prosseguir e o servidor envia exclusivamente `PIX` ou `CREDIT_CARD` ao Asaas; `BOLETO` e `UNDEFINED` são rejeitados. Plus e Pro possuem assinaturas mensais e anuais. O cupom desconta somente a primeira cobrança e a recorrência retorna ao valor normal. Isso não é Pix Automático: cada renovação Pix precisa ser paga; no cartão, a cobrança pode ser automática.

### Checkout hospedado para cartão (em homologação)

O fluxo de cartão usa o Checkout hospedado do Asaas (`POST /v3/checkouts`), com `CREDIT_CARD` e `RECURRENT`. O servidor grava `checkout_id` em `asaas_card_checkouts` e associa a assinatura ao pedido após um evento `SUBSCRIPTION_CREATED` validado na API. **Nem o retorno do Checkout, nem `CHECKOUT_PAID`, nem `SUBSCRIPTION_CREATED` liberam planos sozinhos**: os benefícios são liberados somente após consultar uma cobrança realmente confirmada no Asaas.

A rota de cartão permanece bloqueada na produção, mesmo que uma flag seja ativada. No Sandbox isolado, requer simultaneamente `ASAAS_MODE=sandbox`, `ASAAS_BILLING_ENABLED=true`, `ASAAS_WEBHOOK_READY=true` e `ASAAS_CARD_CHECKOUT_ENABLED=true`. No GitHub, a flag de testes vem de `SANDBOX_ASAAS_CARD_CHECKOUT_ENABLED` e permanece `false` por padrão. Não habilite o cartão antes de configurar e confirmar os webhooks `CHECKOUT_CREATED`, `CHECKOUT_PAID`, `CHECKOUT_CANCELED`, `CHECKOUT_EXPIRED` e `SUBSCRIPTION_CREATED`, além dos eventos `PAYMENT_*` necessários.

A criação e o cancelamento de um checkout sintético são verificados no Sandbox sem inserir cartão. Aprovação, recusa, renovação, estorno e identificação de assinatura em checkout real ainda exigem homologação própria com cartões de teste. Um erro na conciliação não autoriza ativação manual ou automática de benefícios.

## 1. Configurar ambientes separados

Em **GitHub → JustJao1/meu-ritmo → Settings → Secrets and variables → Actions**, ambiente `production` usado pelo workflow `Publicar Meu Ritmo`:

| Tipo | Nome | Valor |
|---|---|---|
| Secret | `ASAAS_API_KEY` | Chave real do ambiente (nunca adicionar ao repositório) |
| Secret | `ASAAS_WEBHOOK_TOKEN` | Mesmo token de autenticação configurado no webhook Asaas (32–255 caracteres, sem espaços) |
| Variable | `ASAAS_MODE` | `sandbox` para homologação ou `production` para vendas reais |
| Variable | `ASAAS_WEBHOOK_READY` | `true` somente quando houver entregas autenticadas e válidas |
| Variable | `ASAAS_BILLING_ENABLED` | `false` até finalizar os testes; `true` para habilitar novas contratações |
| Variable | `EARLY_ACCESS_ENABLED` | `true` enquanto houver acesso antecipado; `false` no lançamento das vendas |

As chaves do Sandbox e Produção são diferentes e não devem ser reutilizadas entre ambientes. Em novas chaves, o prefixo de produção é `$aact_prod_` e o de Sandbox é `$aact_hmlg_`. A aplicação bloqueia chaves novas com prefixo incompatível.

A interface mostra as pendências em **Administração → Lançamento**, incluindo o botão **Testar conexão Asaas (sem cobrança)**. Esse teste realiza um `GET` de leitura, sem cadastrar clientes ou gerar faturas.

## 2. Configurar o webhook no Asaas

No ambiente correspondente, acesse **Integrações → Webhooks**.

- URL final: `https://meuritmo.net/api/billing/webhook/asaas`
- Método recebido: `POST`
- Token de autenticação: exatamente o valor salvo em `ASAAS_WEBHOOK_TOKEN` (não use a API Key como token)
- Envio: preferencialmente `SEQUENTIALLY` para preservar a ordem
- Eventos essenciais: `PAYMENT_CREATED`, `PAYMENT_UPDATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED` e eventos de chargeback disponíveis
- Configure um e-mail para avisos e acompanhe os **Logs de Webhooks**.

O servidor verifica o header `asaas-access-token` e consulta o pagamento diretamente pela API antes de liberar qualquer benefício. Eventos repetidos são ignorados. Uma cobrança criada não equivale a pagamento confirmado.

## 3. Homologar antes de vender

Teste com dados e chave exclusivamente do Sandbox:

1. Criar um cliente de teste e contratar Plus mensal sem cupom.
2. Escolher Pix e criar uma assinatura com `billingType=PIX`; abrir a fatura do Asaas. Repetir com cartão de crédito usando `billingType=CREDIT_CARD`.
3. Confirmar Pix ou cartão no Sandbox e verificar entrega do webhook, atualização de `subscriptions` e liberação do benefício.
4. Tentar enviar `BOLETO`, `UNDEFINED` ou omitir o meio de pagamento diretamente na API do Meu Ritmo: todas as tentativas devem ser rejeitadas antes de chamar o Asaas. Cobranças Pix pendentes não podem liberar uma assinatura.
5. Contratar usando cupom válido; confirmar desconto apenas na primeira cobrança e preço padrão na renovação seguinte.
6. Validar cupons vencidos, limite de usos, código inválido e tentativas simultâneas.
7. Cancelar a renovação; confirmar ausência de novas cobranças e preservação do período já pago.
8. Simular reenvio de eventos, estorno e chargeback; confirmar que não há duplicação e o benefício é revisto conforme o pagamento. Testar também estorno parcial, estorno de renovação mantendo o período anterior pago, fatura paga após o cancelamento e evento atrasado de assinatura antiga.
9. Testar um código inválido e um token de webhook incorreto: ambos devem ser rejeitados.
10. Conferir resultados em dois usuários para garantir que faturas e planos não se misturam.

A integração atual não cria novas cobranças por boleto. Uma cobrança antiga já criada diretamente no Asaas, se existir, deve ser tratada conforme seu histórico, sem bloquear conciliação ou reembolso.

## 4. Habilitar produção

Somente depois dos testes reais, da revisão de termos, privacidade, política de cancelamento/reembolso e da configuração correta dos dados comerciais:

1. Instale a **chave de produção** e um **novo token de produção** em Secrets.
2. Configure o webhook na conta Asaas de produção e verifique entregas autenticadas.
3. Ajuste `ASAAS_MODE=production` e `ASAAS_WEBHOOK_READY=true`.
4. Mantenha `ASAAS_BILLING_ENABLED=false` até concluir a conferência.
5. Ajuste `EARLY_ACCESS_ENABLED=false` somente quando for encerrar a campanha gratuita.
6. Por último, ajuste `ASAAS_BILLING_ENABLED=true` e execute **Publicar Meu Ritmo** no GitHub Actions.
7. Teste uma contratação legítima de valor conhecido e monitore conciliação, fatura e acesso do usuário.

O workflow deixa novas cobranças **desativadas por padrão**. Não coloque chaves, CPF/CNPJ de pagadores ou dados de cartão nos logs, no frontend, no APK ou em mensagens.

## 5. Se uma cobrança ficar presa em revisão

Não gere novamente uma cobrança sem conferir seu pedido no Asaas. Um timeout pode ocorrer depois que o provedor já criou uma assinatura. Consulte o pedido e o identificador de assinatura, os logs do webhook e o painel Asaas antes de resolver a pendência.

Referências: https://docs.asaas.com/reference/criar-nova-assinatura ; https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook ; https://docs.asaas.com/docs/diferen%C3%A7a-entre-pix-autom%C3%A1tico-e-assinaturas-1
