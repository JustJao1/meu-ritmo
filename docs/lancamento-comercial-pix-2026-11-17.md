# Lançamento comercial do Meu Ritmo — Pix (17/11/2026)

## Decisão operacional
- Comercializar Plus e Pro **somente por Pix**, com períodos de um mês ou um ano e **renovação manual**. Não anunciar débito automático.
- Não habilitar cartão de crédito, boleto nem Pix Automático nesta versão.
- O plano é liberado **somente após verificação do pagamento** pela API do Asaas; nunca por redirecionamento de checkout.
- Toda transferência ou estorno que dependa de ação crítica permanece sujeito à autorização manual do titular. O webhook de autorização de saque **não** é pré-requisito para lançar vendas por Pix.

## Evidências já verificadas
- Sandbox, 17/11: 1 chave Pix ACTIVE, cobrança PIX e QR dinâmico HTTP 200, Pix Copia e Cola válido:
  https://github.com/JustJao1/meu-ritmo/actions/runs/44144066273
- Sandbox, 17/11: checkout Pix hospedado criado e cancelado, sem pagamento:
  https://github.com/JustJao1/meu-ritmo/actions/runs/44144136726
- Sandbox, 17/11: pagamento fictício de assinatura, webhook autenticado, Plus ativado no banco isolado, reenvio idempotente, token incorreto recusado, cancelamento preservando período já pago:
  https://github.com/JustJao1/meu-ritmo/actions/runs/43814440423
- Produção, 17/11: 1 chave Pix ACTIVE, checkout Pix hospedado criado e cancelado, sem pagamento real:
  https://github.com/JustJao1/meu-ritmo/actions/runs/44106990625
- Produção, 17/11: webhook Asaas v3 ativo e não interrompido, eventos necessários presentes. Cartão indisponível no site:
  https://github.com/JustJao1/meu-ritmo/actions/runs/44010979511
- Testes automatizados existentes para conciliação do Pix hospedado cobrem: não liberar sem confirmação, divergência de pagador/valor/tipo, reenvio de eventos e revogação por estorno confirmado.

## Sete frentes

1. **Configuração comercial:** `deploy.yml` exige `ASAAS_MODE=production` e `ASAAS_WEBHOOK_READY=true` antes da publicação; o próprio workflow define Pix habilitado, cartão desabilitado e acesso antecipado encerrado. A auditoria deve refletir as flags *efetivas* do workflow, não variáveis legadas divergentes no GitHub.
2. **Compra comercial completa:** **pendente de validação real**. Fazer uma compra controlada autorizada, pelo próprio formulário do Meu Ritmo (não pelo script de API), pagar Pix e validar pedido, valor, `CHECKOUT_PAID/PAYMENT_RECEIVED`, plano ativo e período correto no D1 de produção. A criação/cancelamento de checkout sozinha não prova a liquidação. O agente não deve efetuar pagamento com dinheiro real sem autorização explícita do titular.
3. **Planos/benefícios:** conferir Gratuito, Plus e Pro e seus limites. Conferir especialmente espaço compartilhado no Plus e assistente inteligente no Pro. O backend de benefícios não pode usar redirecionamento de checkout como prova de pagamento.
4. **Renovação e atendimento:** Pix exige nova compra manual após o vencimento. O checkout pendente pode ser cancelado; período pago permanece ativo até o fim (salvo estorno). Pedidos de reembolso seguem fluxo de atendimento e autorização do titular. Estorno Asaas Sandbox ainda aguardou aprovação de ação crítica, e a conclusão real não deve ser presumida.
5. **Informações comerciais:** preços no código: Plus R$ 19,90/mês ou R$ 199,90/ano; Pro R$ 29,90/mês ou R$ 299,90/ano. Confirmar informações do operador e contato público já cadastrados e coerência das políticas em português, inglês e espanhol. Não prometer preço futuro fixo.
6. **Auditoria e testes:** rodar `npm run typecheck`, `npm test` e `npm run build` na verificação do GitHub. Validar celular, cadastro/login, sessão persistida, compra, telas de plano, administração, três idiomas e leitura da política.
7. **Publicação/monitoramento:** liberar somente após CI aprovado; verificar `GET /api/billing/status` e executar auditoria de produção sem criar cobranças. Monitorar novas cobranças, notificações, pedidos pendentes ou `review`, liberar plano somente após confirmação.

## Condições que não podem ser tratadas como concluídas
- Uma compra pelo checkout hospedado do **próprio site**, com Pix de fato pago e liberação do Plus/Pro em produção, ainda precisa de comprovação.
- Reembolso efetivamente concluído e conciliado, no fluxo comercial, ainda precisa de validação.
- Cartões fictícios de recusa no Sandbox do Asaas continuavam retornando `CONFIRMED` em 17/11/2026; cartões devem permanecer desligados.

## Plano de reversão
- Em caso de falha de checkout, desabilitar **novas** compras sem impedir processamento de webhooks de cobranças já existentes. Preservar períodos pagos e pedidos pendentes.
- Reverter o deploy para a última versão validada usando o workflow de publicação/Cloudflare. Conferir migrações antes de qualquer rollback que envolva banco.
