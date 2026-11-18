# Operação do Meu Ritmo

Monitoramento: o workflow **Monitorar Meu Ritmo** consulta a rota `/api/health` a cada 15 minutos, faz três tentativas, abre um incidente no GitHub em caso de falha e o fecha após a recuperação. Ele não reinicia nem altera pagamentos.

A rota de saúde testa a conexão com D1 e a presença da configuração essencial de autenticação e Asaas, sem expor credenciais, dados de usuários ou detalhes de cobranças. Não mede o sucesso de uma cobrança real; complemente a observabilidade com logs do Cloudflare e a conciliação Asaas.

Banco de dados: o D1 possui recuperação por ponto no tempo (Time Travel) nos bancos compatíveis. Confirme em Cloudflare que este banco é do tipo `production`, verifique a janela de retenção disponível para a conta e documente um procedimento de recuperação em ambiente de teste antes de executar qualquer restauração em produção. Nunca restaure o banco comercial sem avaliar pagamentos e mensagens que chegaram após o ponto escolhido.

Asaas: monitore entregas e falhas do webhook no painel Asaas. Se um evento tiver sido recebido mas não processado, reconcilie com a API oficial antes de alterar o plano do usuário. Não faça concessão manual de acesso sem confirmação financeira.

Suporte: a aba Atendimento usa protocolos privados, mensagens persistidas e resposta administrativa. Somente o dono do protocolo pode lê-lo. Administradores autorizados podem acompanhar e responder. Notificações de nova resposta aparecem dentro da conta; não há promessa de notificação por WhatsApp/e-mail.

Autenticação: códigos adicionais após 24 horas de desconexão são exigidos quando não existe outra sessão ativa no servidor. A confirmação por e-mail é necessária para criar uma conta. O WhatsApp exige integração oficial com modelo de autenticação previamente aprovado, além de verificação do próprio número na área Segurança da conta.

Variáveis necessárias à integração WhatsApp (ainda não configuradas automaticamente):
`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_AUTH_TEMPLATE` e, opcionalmente, `WHATSAPP_TEMPLATE_LANGUAGE` (padrão `pt_BR`). Nenhum código secreto deve ser salvo no GitHub ou exposto ao cliente. Verifique testes reais de envio, expiração e entrega antes de liberar a escolha comercialmente.

**Ativação em etapas:** o segundo fator foi colocado atrás de `LOGIN_STEP_UP_ENABLED` (padrão `false`) para evitar bloqueio de clientes existentes enquanto a configuração real do template *Magic Link* do Supabase não for validada. Configure o template de e-mail para incluir `{{ .Token }}` e teste emissão/validação, expiração e reenvio usando uma conta autorizada, antes de definir a variável GitHub Actions `LOGIN_STEP_UP_ENABLED=true`. O canal WhatsApp requer Meta habilitada, template de autenticação aprovado e telefone comprovadamente verificado. Sem essas etapas, somente a verificação de cadastro por e-mail permanece ativa, como antes.
