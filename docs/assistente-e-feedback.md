# Assistente, ilustrações e feedback

Implementação de 16/11/2026.

## Assistente na tela Hoje

O recurso pertence a Plus e Pro. O servidor verifica o plano em cada chamada de
`POST /api/assistant`; durante a campanha de acesso antecipado, a política vigente
concede Pro temporário a todas as contas e, portanto, também este recurso.

O interpretador desta versão é próprio, baseado em regras em português; não é um
chat generativo e não chama serviços externos de IA. Comandos fora da cobertura
pedem esclarecimento. A interface explicita a língua suportada e exemplos.

Suporta tarefas, compromissos com horário, lembretes, notas, despesas, dias da
semana e recorrências diárias/mensais. Um pedido pode conter várias instruções
separadas por ponto e vírgula ou quebra de linha. Pode consultar os gastos do dia
ou mês e mostrar as atividades de hoje/amanhã. Não registra receitas, transfere
dinheiro, apaga registros ou envia mensagens.

“Organize minha semana” distribui até 20 tarefas existentes, pendentes e sem
horário, dentro da disponibilidade configurada. Não muda compromissos fixos,
recorrências existentes ou antecipa tarefas para antes da data cadastrada. A
duração padrão é explícita e ajustável. Conflitos de horários são sinalizados.

Cada proposta é validada com o mesmo esquema do cadastro manual. O usuário pode
editar título, data e horários antes de confirmar; propostas com perguntas ficam
bloqueadas até nova análise. A aplicação recusa uma proposta se os registros
mudaram depois da análise. Nenhuma gravação ocorre no endpoint do assistente:
a confirmação utiliza o salvamento existente da conta, com revisão concorrente
e opção de desfazer. A demonstração usa apenas dados temporários.

## Feedback e respostas

Disponível a todas as contas, pelo perfil, configurações e atalho discreto da
barra lateral. Nota de 1 a 5, tipo, mensagem de 10 a 3.000 caracteres e protocolo.
O usuário vê apenas seus feedbacks e pode acrescentar mensagens.

A aba administrativa “Opiniões” mostra média, distribuição das notas, pendências,
filtros, paginação e conversa. Administradores podem responder e marcar recebido,
em análise, planejado ou resolvido. Respostas e mudanças de status geram um aviso
não intrusivo dentro do site, consultado a cada minuto com a aba visível. Não há
e-mail nem promessa de prazo de resposta. Uma mensagem adicional do usuário
reabre um feedback resolvido.

Os endpoints exigem sessão, verificam origem nas escritas e aplicam limites.
IDs de envio permitem repetir uma requisição sem duplicar mensagens. Mudanças
administrativas têm auditoria. A exportação de privacidade inclui feedbacks e
mensagens; a exclusão dos dados da conta também os remove. Dados de pagamento e
segredos não devem ser enviados no texto.

## Ilustrações

Ilustrações vetoriais próprias, discretas e sem rastreamento, na apresentação,
nas telas vazias e no feedback. Usam as cores do tema atual, sem imagens sobre
listas preenchidas. São decorativas e ocultas da leitura por leitor de tela.

## Validação

Testes de parser e de endpoints com SQLite real: recorrências, conflitos, valores,
datas, isolamento de contas, bloqueio Free, Plus/Pro, respostas, avisos, auditoria,
CSRF e idempotência. A suíte completa e o build devem passar antes de publicar.
Nenhum conjunto finito de testes garante ausência absoluta de erros.
