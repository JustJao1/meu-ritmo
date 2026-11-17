# Pagamentos do MR: Meu Ritmo — somente Pix

> **Atualização em 17/11/2026:** as pendências de chave Pix e QR descritas abaixo são históricas e foram superadas. O Sandbox passou na criação de cobrança Pix, QR dinâmico e Pix Copia e Cola; a produção passou na criação e cancelamento de checkout Pix com chave ativa. O site usa **checkout Pix hospedado, compra por período e renovação manual**. Ainda falta comprovar a compra paga e conciliação pelo próprio checkout comercial em produção. Os cartões continuam desabilitados. Consulte [o plano atualizado](./lancamento-comercial-pix-2026-11-17.md) antes de agir; não use esta lista histórica para recriar chaves ou suspender um checkout que já funciona.\n\nAtualizado em 16/11/2026. Este documento descreve a configuração vigente do site principal e do Sandbox isolado. **Não habilitar cobranças reais até obter um QR Code Pix válido e testar o recebimento por webhook.**

## Funcionamento implementado

- O usuário pode solicitar apenas `paymentMethod=PIX`. A API rejeita `CREDIT_CARD`, `BOLETO`, `UNDEFINED` ou um método ausente. A opção de cartão foi removida da interface.
- Plus e Pro mantêm planos mensais e anuais. Pix convencional **não é Pix Automático**: cada renovação precisa ser paga novamente.
- O servidor solicita uma assinatura `PIX` ao Asaas. O Sandbox, no entanto, a devolveu como `BOLETO`. O servidor converte a cobrança individual para `PIX` via `PUT /payments/{id}` e só permite prosseguir quando o provedor retorna um QR Code Pix verificável.
- A URL da fatura hospedada pelo Asaas não é oferecida ao usuário, pois ela poderia mostrar boleto. O Meu Ritmo utiliza a página própria `/pagar?pedido=<uuid>`, com QR Code e código Pix Copia e Cola obtidos diretamente pela API Asaas.
- O endpoint `POST /api/billing/pix` exige autenticação, mesma origem, pedido pertencente ao usuário, assinatura/cliente associados no Asaas e valor esperado. Ele nunca retorna dados de pagamento de outros usuários. Se o QR falhar, responde sem oferecer boleto ou cartão.
- O botão Consultar fatura/assinatura abre essa mesma página Pix, inclusive para renovações. Checkouts de cartão históricos continuam conciliáveis para tratamento de eventos e estornos, mas não podem ser reabertos para novas compras.
- O webhook só libera o plano depois de consultar a cobrança confirmada e vinculada à assinatura, ao valor e ao pagador corretos. Para contratos com consentimento Pix, boleto pago sem evidência de liquidação Pix **não ativa o plano** e é marcado para revisão, sem interromper a fila sequencial.
- O cancelamento impede novas renovações, preservando o acesso já pago conforme a política vigente.
- A interface da compra e a página Pix oferecem suporte a português (Brasil), inglês e espanhol.

## Resultado da homologação real

A execução real do Sandbox registrou:

1. A assinatura solicitada como `PIX` retornou `billingType=BOLETO`.
2. A primeira fatura pendente também retornou `BOLETO`.
3. A conversão da fatura com `PUT /payments/{id}` foi aceita: HTTP 200, fatura passou a `PIX`.
4. A consulta de `GET /payments/{id}/pixQrCode`, **antes e após a conversão**, retornou HTTP 400 `invalid_action`: a conta não tem uma chave habilitada **para recebimentos de cobranças via Pix**.
5. Na consulta original, o Sandbox listou duas chaves `ACTIVE`. A conferência posterior comparou os valores com o painel e confirmou as mesmas três chaves. No teste ampliado às 13h30 (Brasília), a API já listou quatro chaves `ACTIVE`. A existência e o estado das chaves estão comprovados; não está comprovada a razão interna da recusa do QR dinâmico.
6. A conta **de produção lista zero chaves Pix** por `GET /pix/addressKeys`. Isso impede declarar a integração pronta para cobranças reais.

Evidências:
- [Teste Pix Sandbox e erro detalhado](https://github.com/JustJao1/meu-ritmo/actions/runs/43875879401)
- [Chaves Pix de produção — auditoria somente leitura](https://github.com/JustJao1/meu-ritmo/actions/runs/43877687864)
- [Documentação Asaas: QR Code Pix](https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix)
- [Ajuda Asaas: habilitar/desabilitar Pix por cobrança](https://central.ajuda.asaas.com/hc/pt-br/articles/54589020383643-Como-desabilitar-o-recebimento-por-Pix-nas-cobran%C3%A7as-do-Asaas)

## Diagnóstico ampliado de QR Pix (16/11/2026, 13h30 Brasília)

- A conta Sandbox aberta no painel corresponde às chaves retornadas pela credencial do ambiente de testes do GitHub.
- O controle **Disponibilizar recebimento de cobranças por Pix** já estava habilitado. Foi desabilitado e reabilitado somente no Sandbox; o erro persistiu no teste seguinte. Não atribuir a falha a esse controle estar desligado.
- Uma cobrança avulsa solicitada e persistida como `PIX` também recebeu HTTP 400 no QR dinâmico. Portanto, a falha não é exclusiva da assinatura nem da conversão de boleto.
- O endpoint de QR estático retornou HTTP 200, payload e imagem para cada uma das quatro chaves ativas. Os QRs de teste foram removidos e as cobranças de teste canceladas.
- A assinatura voltou como `BOLETO`; sua conversão para `PIX` foi aceita, porém o QR dinâmico continuou recusado.
- A causa interna da inconsistência permanece sem comprovação. Não afirmar que todas as chaves estão desabilitadas ou que a integração foi homologada.
- QR estático tem conciliação diferente: o pagamento cria uma cobrança nova, associada a `pixQrCodeId`, sem vínculo prévio ao pagador e à assinatura. Não substituir o QR dinâmico no aplicativo sem implementar e homologar esse vínculo e os eventos de pagamento/estorno. Exibir um QR isolado não conclui a integração.

Evidência do teste ampliado: https://github.com/JustJao1/meu-ritmo/actions/runs/43908142130

## Pendências de ativação

No Sandbox, **Minha conta → Configurações → Configurações do sistema → Disponibilizar recebimento de cobranças por Pix** foi conferido habilitado. Em produção, conferir separadamente esse controle. Esta configuração não tem endpoint público de alteração documentado; não tentar reproduzir chamadas privadas do painel.

Na conta **de produção**, cadastrar e ativar uma chave Pix legítima em **Pix → Minhas chaves**. A API indica zero chaves atualmente. Não inventar CPF/CNPJ, telefone, e-mail ou chave do titular. Uma EVP aleatória pode ser criada pelo titular se desejado, observando as regras e requisitos cadastrais da conta.

Após a ativação, repetir o teste Sandbox e confirmar `pixQrCode` HTTP 200, `payload` e `encodedImage` válidos. Confirmar também o funcionamento real em produção, preferencialmente com cobrança de valor conhecido autorizada pelo titular, e a liquidação/conciliação webhook.

## Variáveis de produção

Estas configurações já foram auditadas:
- Chave da API de produção: presente e autenticando corretamente.
- Webhook de produção: registrado, ativo, endereço `https://meuritmo.net/api/billing/webhook/asaas`, versão 3 e eventos de pagamento, checkout, recusa e estorno configurados.
- Identificação comercial na produção: completa.
- `ASAAS_MODE=production`.
- `ASAAS_BILLING_ENABLED=false` — manter até provar geração, pagamento e liberação de Pix.
- `EARLY_ACCESS_ENABLED` ausente no GitHub: deploy assume `true`, portanto o acesso antecipado continua liberando Pro e bloqueando novas assinaturas.
- `ASAAS_CARD_CHECKOUT_ENABLED` e `ASAAS_PRODUCTION_CARD_APPROVED`: não habilitar; o endpoint de contratação aceita exclusivamente Pix, independentemente destas flags.

A alteração da campanha `EARLY_ACCESS_ENABLED` afeta os usuários com Pro gratuito. Não desativá-la só para testar cobrança.

## Quando estiver pronto para lançamento

1. Habilitar recebimento Pix e ativar uma chave Pix na conta real do Asaas.
2. Homologar com QR válido e evento real de confirmação na conta Sandbox; validar cancelamento, renovação e acesso.
3. Confirmar dados comerciais, preços, política de cancelamento e suporte ao consumidor.
4. Encerrar acesso antecipado quando autorizado pelo titular (`EARLY_ACCESS_ENABLED=false`) e habilitar cobrança geral (`ASAAS_BILLING_ENABLED=true`); redeploy e monitoramento.
5. Não habilitar cartões nem boletos.

**Importante:** não compartilhar chaves de API, tokens de webhook, chaves privadas ou dados completos de pagadores por chat, log ou repositório.
