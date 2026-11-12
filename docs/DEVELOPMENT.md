# Meu Ritmo

Aplicação pt-BR em React/Vinext, Cloudflare Workers, D1 e R2. A página `/` apresenta o produto e uma demonstração temporária; `/app` contém a conta real, vazia no primeiro acesso. O ambiente de publicação começa privado.

## O que funciona

Login e saída com a identidade ChatGPT; armazenamento D1 isolado por identificador de usuário; validação Zod no servidor, limite de notas fixadas, verificação de origem e controle de revisão para impedir sobrescrita entre abas. Nenhuma chave de pagamento é enviada ao navegador.

Hoje, agenda diária/semanal/mensal, gastos por mês/categoria e orçamento, tarefas recorrentes com conclusão por ocorrência, adiamento e reordenação, notas com listas, busca, etiquetas, cores, fixação e arquivo, conversão de notas em tarefas/lembretes, exportação JSON, guia em duas etapas, desfazer exclusão/arquivo/conclusão, edição e exclusão confirmada.

Recorrência mensal ajusta dia 29/30/31 para o último dia de meses menores. Alterar um item recorrente altera sua série. Gastos recorrentes são projeções da série em cada mês e não transações bancárias conciliadas. A categoria de um gasto é definida manualmente. Orçamento é um valor mensal padrão. A versão atual trabalha no fuso America/Sao_Paulo.

## Autenticação

A hospedagem controla cadastro, login, recuperação e saída via conta ChatGPT. Não há cadastro local por e-mail/senha, envio de recuperação próprio ou armazenamento de senhas. Rotas de dados rejeitam visitantes sem identidade. Não simule cabeçalhos de identidade em produção. O domínio privado exige a conta autorizada para acessar inclusive a apresentação. Tornar a apresentação realmente pública requer uma mudança explícita da audiência; a API continuará verificando identidade.

## Notificações

Avisos visuais no horário configurado são verificados a cada 15 segundos enquanto a página está aberta e o dispositivo ativo. A permissão é solicitada quando o usuário ativa seu primeiro aviso ou testa notificações. Um teste sonoro separado usa Web Audio. O aplicativo não promete despertar o aparelho, tocar com o site fechado ou oferecer push persistente. Os avisos usam service worker para permanecer na central de notificações onde suportado; o disparo continua dependendo da página aberta. Não existe agendador servidor nesta implantação. Push persistente requer Web Push/VAPID, armazenamento de inscrições e infraestrutura de jobs; não estão implementados.

## Assinaturas: integração preparada, não ativada

Os benefícios funcionais são definidos em `lib/plans.ts`, com preços e limites centralizados. Gratuito: uso diário, orçamento com revisão de excessos, 3 notas fixadas e exportação JSON. Plus: quatro temas completos, seis destaques, títulos editoriais, espaçamento compacto, distintivos, adesivos, texturas de notas, 20 notas fixadas e quatro modelos de rotina. Pro: tudo do Plus, uma cor própria, 100 notas fixadas, até 20 modelos pessoais e relatório financeiro de seis meses com CSV. Múltiplos espaços e automações não são vendidos nesta versão.

`Meu estilo` reúne uma prévia visual que não altera a conta até Aplicar. A demonstração possui seletor explícito de plano, exclusivo de dados temporários. Na conta real, o servidor consulta a assinatura; nenhuma seleção no navegador libera planos. Personalizações e modelos são validados no servidor. Ao expirar, dados e configurações são preservados; o visual gratuito é aplicado e continuam disponíveis leitura, edição básica, exclusão e exportação. Não habilite vendas em produção antes de validar o ciclo Stripe completo.

Há endpoints para Checkout e portal Stripe, além de webhook HMAC SHA-256 com janela de cinco minutos, deduplicação, consulta do estado atual da assinatura no servidor e registro transacional. Não há liberação por URL de sucesso. O modo padrão é teste. O modo live exige ativação explícita e chaves compatíveis; eventos de um modo diferente são rejeitados. O redirecionamento de sucesso não muda o plano. Uma assinatura de teste só libera benefícios após um webhook válido registrar plano ativo/trialing e prazo futuro. O plano volta a Gratuito quando o prazo expira ou o status deixa de ser ativo/trialing. Nenhum fluxo de pagamento foi validado junto à Stripe por falta de credenciais.

Configuração necessária:

1. Criar uma conta Stripe e produtos/preços recorrentes de teste em BRL, para Plus/Pro mensal/anual.
2. Configurar como secrets do Site `STRIPE_SECRET_KEY` (`sk_test_...`), `STRIPE_WEBHOOK_SECRET` e os quatro IDs `STRIPE_PLUS_MONTH_PRICE`, `STRIPE_PLUS_YEAR_PRICE`, `STRIPE_PRO_MONTH_PRICE`, `STRIPE_PRO_YEAR_PRICE`.
3. Habilitar o portal de clientes em modo teste e as opções de alteração/cancelamento.
4. Configurar entrega autenticada de eventos `customer.subscription.created`, `customer.subscription.updated` e `customer.subscription.deleted` em `/api/billing/webhook`.
5. A audiência privada bloqueia chamadas externas anônimas, inclusive da Stripe. Antes de habilitar testes reais, tornar o Site público com autorização do proprietário ou instalar um relay de webhook que valide Stripe e encaminhe com o mecanismo de acesso de serviço suportado pela hospedagem. Não inserir tokens no URL. Sem isso, a entrega direta não funciona.
6. Definir `BILLING_TEST_ENABLED=true`, publicar e testar checkout, webhook duplicado, evento fora de ordem, pagamento falho, cancelamento e portal. Os botões de verificação estão em Planos → Sobre o Plus/Pro. Checkout de teste na interface respeita o plano Plus/Pro escolhido e o período mensal/anual.

Documentação utilizada: https://docs.stripe.com/api/checkout/sessions/create , https://docs.stripe.com/events/manage-webhook-endpoints , https://docs.stripe.com/api/customer_portal/sessions/create .

## Desenvolvimento e testes

`npm ci`, `npm run db:generate` após mudar schema, `npx tsc --noEmit`, `node --experimental-strip-types --test tests/domain.test.mjs tests/api.test.mjs`, `node scripts/build-site.mjs` pela infraestrutura Sites (ou `npm run build` para build local). Os helpers oficiais de Sites ficam no plugin e o comando de build normal do projeto é `npm run build`.

Migrations em `drizzle/` são imutáveis e aplicadas pela hospedagem. Para banco local use o Wrangler com `dist/server/wrangler.json`, `.wrangler/state` e cada arquivo SQL em ordem. Dados de teste não entram em migrations.

## Limites conhecidos

A API salva o documento da conta por revisão, com limite de 1,5 MB e 10 mil itens. Em conflito entre abas, exporte o estado local e recarregue. Alterações pendentes são sinalizadas; não há fila offline. Notas já existentes salvam o conteúdo enquanto se escreve; novas notas precisam da primeira ação Salvar. Não há anexos, integração bancária, múltiplos fusos, múltiplos espaços, recorrências avançadas, e-mail/SMS ou automações servidor. Dados continuam legíveis e exportáveis sem pagamento. As funções pagas implementadas podem ser experimentadas no modo demonstração, identificado. A cobrança continua indisponível até configurar o provedor.

## Gastos acima do orçamento e revisão do dia

O resumo de gastos e o indicador do menu Gastos ficam em alerta vermelho quando o total mensal ultrapassa o orçamento. `Revisar excesso` registra justificativa com pelo menos dez caracteres, total revisado, orçamento e data. O estado passa a âmbar, com o excesso ainda explícito; a justificativa não reduz nem apaga despesas. Qualquer mudança no total do mês ou no orçamento invalida a revisão anterior. As justificativas são gratuitas e isoladas por usuário, com até 120 meses de histórico.

`Passar o dia a limpo`, na tela Hoje, mostra tarefas pendentes com ações de conclusão/adiamento, o estado do orçamento e um acesso à agenda de amanhã. É uma revisão voluntária; não usa pontuação, sequências ou recomendações geradas por IA.

## Validação desta versão

Testes automatizados cobrem isolamento, revisões concorrentes, validação dos dados, pin limits, recorrências, autenticação ausente, assinatura sem configuração, customizações e modelos restritos no servidor, expiração de benefícios com preservação dos dados, relatório restrito e revisão de excesso. O fluxo Stripe real permanece não validado por falta de credenciais e da configuração de entrega dos webhooks do Site privado.

## Administração e códigos promocionais

O perfil real consulta `/api/account` a cada abertura. O link Administrador aparece somente para `owner` ou `admin`; a demonstração nunca o mostra. `/admin` verifica a identidade no servidor antes de renderizar. `/api/admin` repete a autorização em cada consulta e operação, além de verificar a origem das alterações.

`ADMIN_OWNER_EMAIL` é um secret de ambiente configurado para o e-mail verificado do proprietário do Site. Não existe promoção por URL, domínio de e-mail, dados do navegador ou pelo primeiro cadastro. Sem a configuração, o proprietário não é inferido. O proprietário é protegido contra remoção e é o único que pode nomear ou remover administradores. Administradores podem gerenciar códigos e concessões e ler o histórico; não podem ler gastos, agenda ou notas de outras contas. O papel administrativo não concede automaticamente um plano Plus/Pro.

Contas são cadastradas no diretório de administração ao acessar o aplicativo autenticado. O diretório mantém somente identificador, nome de exibição, e-mail e datas de acesso. A busca lista até 20 contas por página. Códigos, concessões e histórico mostram os últimos 100 resultados da busca. Uma pessoa precisa ter acessado o aplicativo antes de receber uma concessão ou permissão; o painel não envia convites. Se o Site estiver privado, o acesso à hospedagem continua sendo uma permissão separada. Esta implantação não muda a audiência do Site.

Concessões manuais liberam Plus ou Pro por 1 a 3.650 dias, com motivo registrado e revogação possível. Códigos liberam de 1 a 365 dias de Plus/Pro, validade para resgate e limite total de 1 a 10 mil usos. Há geração aleatória com `crypto.getRandomValues`, código personalizado opcional, normalização de caixa e uso único por conta. São códigos de benefício, não cupons de desconto Stripe. Funcionam sem as credenciais de pagamento.

O resgate usa lote transacional D1: insere o uso condicionado à validade/limite, incrementa o contador, cria o benefício e registra a auditoria juntos. Um índice único impede resgate repetido pela mesma conta. São permitidas até dez tentativas por conta a cada janela de quinze minutos; respostas posteriores retornam 429. Desativar um código impede novos resgates e preserva concessões anteriores. Revogar um benefício não altera pagamentos, exclui dados ou remove outras concessões. Entre benefícios e assinatura, prevalece o maior plano ativo e, no mesmo nível, o prazo mais longo; os dias não são somados automaticamente.

A auditoria registra ator, alvo, ação, motivo/detalhes permitidos e horário. Não há endpoint de edição ou exclusão do histórico. Os dados pessoais de organização continuam sendo autorizados por identificador em suas próprias rotas.

Testes: `node --experimental-strip-types --test tests/admin.test.mjs tests/api.test.mjs tests/domain.test.mjs tests/d1-promotions.test.mjs`. Incluem autorização, proteção do proprietário, administração delegada, concessão/revogação, preservação de assinatura superior, código expirado/desativado, limite de tentativas, duplicidade, transação revertida após falha e dois resgates disputando a última utilização. O layout administrativo foi conferido com dados isolados de teste; esses componentes e rotas temporários não são publicados. O login real em produção precisa ser feito pelo proprietário; não houve autenticação interativa com a conta dele durante a verificação.

Também foi validado um resgate concorrente com a implementação local D1/Workerd, usando os mesmos endpoints de produção. Dados temporários de teste não são enviados ao banco publicado.


## Comunidade, perfis e privacidade

Comunidade oferece publicações por categoria, busca, respostas, modelos compartilhados e cópia voluntária para tarefas pessoais. Não oferece mensagens privadas nem atualização em tempo real. A participação exige perfil explícito, aceite versionado das regras e declaração de 18 anos. Gastos, notas e agenda não são publicados. Há denúncia, bloqueio bilateral, remoção pelo autor e moderação administrativa com suspensão/restauração social e auditoria. Suspensão social não bloqueia a organização privada.

O nome de usuário é único e só muda após 30 dias; nome de exibição após 14 dias. As duas regras são atômicas no servidor. Bio e foto podem mudar independentemente. Fotos JPEG/PNG/WebP são recortadas para PNG no cliente; o servidor limita tamanho, valida PNG e remove metadados antes de armazenar em R2. Não aceita SVG. Perfis e fotos são visíveis apenas a participantes autenticados.

O rodapé usa a marca Desenvolvido por João Victor. Fontes são locais. A escolha de cookies permite rejeitar preferências sem perda das funções essenciais; somente a lembrança da última área depende dessa permissão. Não há análise ou marketing implementados. Privacidade, Termos e Regras descrevem o comportamento atual. Textos não substituem revisão jurídica nem garantem imunidade a processos.

Privacidade e atendimento oferece exportação própria, protocolos e exclusão autenticada dos dados de organização e participação social com confirmação digitada. A exclusão não cancela pagamentos nem remove identidade de login, permissões administrativas, auditoria e registros de benefícios/cobrança. Isso aparece antes da confirmação. Pedidos administrativos só devem ser resolvidos após atendimento manual; não há envio automático de respostas por e-mail.

## Descontos e ativação comercial

Cupons de planos gratuitos continuam independentes da Stripe. Cupons de desconto podem ser percentuais (até 90%) ou valor fixo em BRL, para Plus, Pro ou ambos, com validade e limite total de usos. Aplicam-se à primeira cobrança. O painel cria rascunhos sem credenciais, permite sincronização explícita e ativação/desativação no provedor. A confirmação e contagem final de descontos dependem da Stripe. Códigos de desconto não liberam benefícios por resgate local. Um registro único evita colisão entre os dois tipos de código.

Configuração adicional: `BILLING_MODE=test` e `BILLING_TEST_ENABLED=true` para sandbox. Para produção, trocar pelos quatro preços e pelas chaves live correspondentes, definir `BILLING_MODE=live`, `BILLING_LIVE_ENABLED=true` e `BILLING_WEBHOOK_READY=true` somente após confirmar entrega dos webhooks e testar o ciclo real. Requisições Stripe usam a versão `2026-10-28.endive`. Configure também o portal de clientes e verifique as regras comerciais e tributárias da conta Stripe. Nunca misture IDs de preços de teste e produção.

No painel Administrador → Lançamento, o proprietário precisa informar identificação do operador, CPF/CNPJ público aplicável, endereço comercial e e-mail de atendimento. Esses dados aparecem nas páginas legais. Checkout permanece desabilitado sem essa identificação, preços e credenciais. A hospedagem continua privada: entregas externas de webhook exigem resolver o acesso conforme explicado acima. Não definir a flag de webhook como pronta antes de validar essa entrega.

Validação atual: TypeScript e 33 testes automatizados, incluindo perfis, prazos, compartilhamento explícito, bloqueios, moderação, higienização de imagem, descontos, termos do checkout e exclusão isolada. Chamadas Stripe foram verificadas com respostas controladas, sem transações reais. Fotos foram testadas no armazenamento de teste; a configuração hospedada solicita R2 pelo manifesto. Rotas e componentes temporários de verificação visual são removidos antes da publicação. Login interativo do proprietário e cobrança real ainda dependem da conta e credenciais dele.


## Revisão de segurança e cadastro obrigatório (12/11/2026)

A identidade ChatGPT é o primeiro passo; o cadastro do Meu Ritmo só termina após escolher @usuário único e nome de exibição e aceitar as condições. `/cadastro` é obrigatório antes de `/app`, administração e APIs de organização. Contas antigas sem perfil também concluem essa etapa, sem perder seus dados. Os intervalos de 30/14 dias continuam no servidor. O aplicativo não guarda senhas e não adiciona outra camada de autenticação própria.

`worker/index.ts` aplica a proteção de entrada: cabeçalhos de segurança, respostas privadas sem cache, origem estrita em alterações, sem CORS aberto, corpos limitados mesmo sem Content-Length, JSON inválido rejeitado e erros genéricos. Caminhos de ambiente, Git, banco e source maps são bloqueados. Limite geral por identidade: 180 requisições de API por minuto, além dos limites de domínio; alteração de perfil: 20 por hora. O login e seus limites são gerenciados pela hospedagem. A identidade só é confiável no ingresso oficial do Sites; não exponha um Worker paralelo que aceite esses cabeçalhos sem essa fronteira.

D1 e R2 são bindings privados do servidor. Não há Firebase/Firestore, Firebase Storage ou Supabase configurados: não são necessários junto de D1/R2 e não foram simulados. Consultas usam parâmetros vinculados e autorização pelo identificador autenticado. O conteúdo é texto renderizado pelo React, sem inserção de HTML recebido de usuários. Nomes rejeitam marcação, controles e caracteres de direção que permitiriam representação enganosa. R2 não oferece bucket público nesta aplicação; leitura de fotos exige login. A infraestrutura de backups, retenção de logs e acesso operacional do provedor deve ser gerenciada pelo responsável da hospedagem.

A política de reembolso está em `/reembolso`, com canal de protocolo `refund`. O atendimento e a restituição exigem ação do operador; não há reembolso financeiro automático. O encerramento da conta remove cadastro do diretório, delegação administrativa, organização, perfil, fotos e conteúdo social; mantém identificador mínimo de encerramento e registros necessários de cobrança, benefícios, atendimento e auditoria. Bloqueia a recriação automática. Uma assinatura não cancelada impede o encerramento até confirmação do provedor; excluir apenas registros continua disponível. A conta ChatGPT permanece independente.

Google Analytics é opcional e DESLIGADO sem configuração: `GA_MEASUREMENT_ID=G-...` e `GA_ENABLED=true` no ambiente do Site. O ID de medição é público, sem secret de acesso no navegador. A tag Google só é carregada na apresentação após consentimento de análise separado, sem identificação da conta ou conteúdo privado; não carrega nas páginas privadas. Cookies de análise têm duração configurada de até 90 dias. Antes de ativar, DESLIGAR medição otimizada, histórico automático, formulários, Google Signals, publicidade e coleta de dados fornecidos pelo usuário na propriedade Google, e revisar suas configurações de retenção/transferência. A propriedade não foi configurada ou testada por falta de ID. Rejeitar análise não faz requisição ao Google; revogar apaga cookies de análise acessíveis e recarrega para descarregar a tag. Não há outros pixels, anúncios ou scripts arbitrários de terceiros.

Ver `SECURITY_REVIEW.md` para escopo, evidências e pendências. Não equivale a pentest externo ou certificação LGPD/WCAG. A audiência do Site permanece privada.

O aviso de cookies não se repete enquanto houver aceitação opcional válida no navegador. Rejeitar mantém as funções opcionais desligadas e fecha o aviso durante a sessão da aba, usando sessionStorage; uma nova sessão pode perguntar novamente. O botão Cookies continua permitindo rever a decisão a qualquer momento.

## Aplicativo Android Lite

A rota /downloads apresenta o Meu Ritmo Lite para Android. O APK experimental é distribuído pelo projeto independente Lite; URL, versão, SHA-256 e tamanho ficam em lib/android-release.json. Não habilite available sem um arquivo real, assinado e verificado. O código nativo e a chave de desenvolvimento não pertencem a este projeto; a chave jamais deve ser servida publicamente. As páginas de apresentação e download são públicas. Dados das contas e administração continuam exigindo autenticação. O site público de distribuição Lite permite baixar o APK sem conta.
