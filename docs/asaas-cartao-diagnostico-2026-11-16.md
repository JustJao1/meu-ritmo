# Diagnóstico da simulação de cartão — Asaas Sandbox (16/11/2026)

## Resultado confirmado

A documentação oficial do Asaas informa que cartões fictícios de recusa devem
simular falha e, na cobrança direta com cartão, uma transação recusada retorna
HTTP 400 sem persistir a cobrança.

A conta Sandbox do Meu Ritmo respondeu de modo diferente. A consulta **somente
leitura** ao histórico de pagamentos, seguida de GET individual em cada cobrança,
mostrou:

| Cenário | Quantidade | Status persistido | Bandeira confirmada pelo Asaas |
|---|---:|---|---|
| Cartão Mastercard de recusa (final 3151) | 10 | 10 CONFIRMED | MASTERCARD |
| Cartão Visa de recusa (final 0741) | 9 | 9 CONFIRMED | VISA |
| Controle de aprovação (final 4444) | 10 | 10 CONFIRMED | VISA |
| **Total** | **29** | **29 CONFIRMED** | |

Todas as 29 cobranças retornaram `billingType=CREDIT_CARD` e data de pagamento
ou confirmação. Nenhuma mudou de status entre a listagem e o GET individual.
Nenhum número completo, token de cartão, identificador de pagador ou chave foi
gravado nos logs da auditoria.

- Evidência de status e bandeiras: https://github.com/JustJao1/meu-ritmo/actions/runs/43813822726
- Evidência independente de status persistido: https://github.com/JustJao1/meu-ritmo/actions/runs/43812993043
- Prova dos 29 pagamentos com consulta individual: https://github.com/JustJao1/meu-ritmo/actions/runs/43812797578
- Documentação de cartões de teste: https://docs.asaas.com/docs/testando-pagamento-com-cart%C3%A3o-de-cr%C3%A9dito
- Documentação da cobrança direta: https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito

## Hipóteses eliminadas

1. **Chave e URL erradas:** a chave de homologação autentica em `api-sandbox.asaas.com/v3`.
2. **Cartão trocado ou campo errado:** a requisição usa `creditCard.number` e o Asaas
   registra os quatro últimos dígitos e a bandeira dos cartões de recusa esperados.
3. **Erro de apresentação no Meu Ritmo:** as cobranças são criadas pelo endpoint
   Asaas `POST /payments` diretamente no teste, sem passar pelo frontend.
4. **Leitura precipitada de resposta HTTP:** o provedor manteve cada cobrança
   `CONFIRMED` no `GET /payments/{id}` individual.
5. **Ausência dos webhooks financeiros:** os webhooks estão cadastrados. No D1
   Sandbox foram contados 30 eventos `PAYMENT_CREATED` e 28 eventos
   `PAYMENT_RECEIVED` com identificadores distintos dos simulados manualmente;
   esses contadores indicam entregas reais, mas não autenticam a origem de cada
   evento por si só.

Relatório D1: https://github.com/JustJao1/meu-ritmo/actions/runs/43813681374

## O que continua sem comprovação

- A razão interna pela qual o simulador Asaas confirmou os cartões de recusa.
- A tentativa completa com cartão recusado na **página hospedada de Checkout**,
  que é o caminho usado pelos usuários. O diagnóstico de recusa acima foi pela API
  de cobrança direta e não deve ser apresentado como teste do formulário hospedado.
- A execução efetiva de um reembolso, pois algumas ações ficaram pendentes de
  autorização no Sandbox.

A documentação de configurações do Sandbox não apresenta opção de usuário para
habilitar especificamente a **recusa por cartão de teste**.
https://docs.asaas.com/docs/como-configurar-sua-conta-no-sandbox

## Medidas tomadas no projeto

- Novas cobranças reais permanecem desligadas (`ASAAS_BILLING_ENABLED=false`).
- Checkout de cartão em produção exige aprovação explícita separada e está
  desativado por padrão.
- O acesso Plus/Pro continua dependente da cobrança confirmada e associada ao
  checkout e à assinatura corretos.
- Os testes unitários cobrem captura recusada e reprovação por análise de risco:
  esses eventos não podem conceder o Pro.
- A conciliação foi reforçada para webhooks que chegarem mais de 24 horas após
  a criação, validando a cobrança pelo `checkoutSession` da API do Asaas.
- A auditoria de pagamentos usa apenas GET e não cria novas cobranças.

## Próxima ação para encerrar a homologação

1. Testar manualmente os mesmos cartões fictícios na página de Checkout
   hospedado do Asaas, usando **somente conta Sandbox** e sem nenhum dado real.
2. Se a recusa não ocorrer também nesse fluxo, compartilhar com o time de
   integrações do Asaas os links de evidência acima e informar que os cartões
   de finais 3151 e 0741 foram confirmados na API mesmo com os números
   documentados para recusa. A causa do simulador somente pode ser corrigida
   pelo operador desse serviço.
3. Depois que a recusa funcionar, repetir aprovação, recusa, ativação,
   renovação, cancelamento e estorno no fluxo de Checkout hospedado.
4. Não ligar as flags de cobrança em produção antes da homologação.

O fato de um teste de recusa falhar no simulador não significa que um cartão
real seja automaticamente aprovado em produção. Não é correto bloquear um
pagamento apenas pela numeração dos cartões de teste no código de produção,
nem simular confirmação ou recusa falsificando o estado persistido do Asaas.
