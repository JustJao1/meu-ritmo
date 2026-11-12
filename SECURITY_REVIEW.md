# Revisão do Meu Ritmo — 12 de novembro de 2026

## Escopo e resultado

Revisão de código, testes automatizados com identidades isoladas, banco SQLite/D1 local e inspeção de interface no navegador. Não houve acesso à conta pessoal do proprietário, transação financeira real ou pentest independente. O ambiente publicado continua restrito ao proprietário.

Resultado automatizado: 40 testes passaram, além da compilação TypeScript e build de produção.

## Controles verificados

- Identidade da hospedagem e autorização repetida no servidor. Dados privados são consultados pelo usuário autenticado, não por IDs enviados na tela. Admin comum não pode nomear outros admins nem acessar organização pessoal de terceiros.
- Cadastro obrigatório com @usuário e nome de exibição, unicidade no banco e prazos independentes de 30/14 dias. Não é possível liberar a organização apenas alterando URL, dados do navegador ou plano.
- D1/R2 só pelo servidor, SQL parametrizado, uploads PNG limitados e saneados, sem SVG/HTML executável. Textos são escapados pelo React.
- Origem estrita em alterações, CORS sem origem aberta, no-store em dados privados, nosniff, HSTS, política de permissões, proteção de enquadramento e CSP. O runtime ainda necessita scripts inline; CSP não usa nonce estrito nesta versão.
- Limite global por identidade e limites específicos de perfil, comunidade, upload, protocolos e códigos. Autenticação e limite de login dependem do provedor.
- Erros externos genéricos, sem stack trace de aplicação; mapas de fonte não publicados como recurso acessível. Ambiente e chaves não são incluídos no código cliente.
- Exclusão isolada e encerramento autenticado, bloqueado enquanto assinatura não estiver cancelada. A confirmação digitada é obrigatória. Cobrança/auditoria/atendimento têm tratamento separado.
- Consentimento de preferências separado de análise, sem opções opcionais pré-selecionadas. Google não carrega antes de permissão; propriedade não ativada por falta de ID.

## Execução como visitante e outra conta

Testes tentam ler organização, perfil, foto e painel sem identidade; pular cadastro; enviar origem externa; explorar caminhos .env/Git/banco; ultrapassar o limite de corpo e tentativas. Outra identidade tenta remover conteúdo alheio, ler/exportar dados privados e alterar funções administrativas. As tentativas cobertas são recusadas. O teste de domínio confirma que apagar uma conta não apaga a organização de outra.

Não se tentou falsificar a autenticação externa em produção. Os testes de identidades usam dependências controladas e dados descartáveis; não substituem verificação independente do ingresso da plataforma. Não houve submissão de cadastro ou aceite de termos em nome do proprietário.

## Acessibilidade

Inspeção de formulário, rótulos associados, indicação de campos obrigatórios, erros anunciados, idioma pt-BR, títulos, botão para pular ao conteúdo e navegação por Tab. Cadastro conferido em desktop e janela de 390 px; banner de cookies com opções separadas e rejeição acessível. O texto secundário foi escurecido para melhorar contraste. A interface já respeita prefers-reduced-motion e mantém foco visível e contenção/restauração de foco nos diálogos.

Esta é uma revisão parcial, não uma declaração de conformidade integral WCAG. Leitores de tela reais, zoom extremo, todos os temas e todas as combinações de navegador/dispositivo ainda exigem auditoria especializada.

## Código, chaves e recursos visuais

A varredura dos cinco commits anteriores não encontrou padrões de chaves Stripe ou chaves privadas, e não havia arquivos .env/.dev.vars rastreados. Isso é evidência limitada aos padrões pesquisados, não prova absoluta de inexistência de segredos. Arquivos locais de ambiente permanecem ignorados. As chaves de runtime são configuradas como secrets, sem valores no repositório. Não houve rotação porque não foi identificado vazamento.

Inventário visual e licenças em THIRD_PARTY_NOTICES.md. Não há imagens de banco de fotos na distribuição. Fotos dos participantes exigem autorização dos respectivos titulares/autores.

## Antes da abertura comercial

Preencher operador e contato públicos, concluir revisão jurídica dos termos/reembolso/privacidade e definir prazos operacionais de retenção e atendimento. Configurar Stripe, portal, preços e entrega validada dos webhooks; executar compra, falha, cancelamento e reembolso reais em teste antes de live. Se ativar Google Analytics, configurar a propriedade conforme README, incluindo desativação da medição otimizada. Configurar backups/recuperação e revisar os acessos operacionais da hospedagem.

Nenhum destes controles garante ausência de falhas ou imunidade jurídica.

Referências consultadas: [ANPD — cookies](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-emite-recomendacoes-para-adequacao-da-pratica-de-coleta-de-cookies-do-portal-gov-br), [CDC atualizado, artigo 49](https://www2.camara.leg.br/legin/fed/lei/1990/lei-8078-11-setembro-1990-365086-normaatualizada-pl.html), [W3C — contraste](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) e [Google — page views](https://developers.google.com/analytics/devguides/collection/ga4/views).

Correção de incorporação: X-Frame-Options SAMEORIGIN removido por impedir a prévia dentro do ChatGPT. A proteção permanece em CSP frame-ancestors, restrita ao próprio Site, https://chatgpt.com e https://www.chatgpt.com. Outros sites continuam sem autorização de enquadramento.
