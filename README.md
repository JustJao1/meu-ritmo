# Meu Ritmo

Seu dia, suas contas e suas ideias em um lugar só. Aplicação de organização pessoal em português do Brasil, desenvolvida por João Victor.

[Visitar o site](https://meu-ritmo-organiza.tonedcamel16.chatgpt.site/) · [Aplicativo Android Lite](https://meu-ritmo-lite.tonedcamel16.chatgpt.site/)

## Recursos

Tela Hoje, agenda, rotina, gastos com orçamento e revisão de excessos, notas e lembretes. O site também inclui perfis, comunidade, modelos de rotina, planos e administração com permissões no servidor.

As páginas de apresentação são públicas. Dados pessoais e administração exigem autenticação. O Lite é um projeto separado, offline e sem conta, disponível em [meu-ritmo-lite](https://github.com/JustJao1/meu-ritmo-lite).

## Desenvolvimento

Requer Node.js 22.13 ou superior. Instale as dependências com `npm ci` e execute `npm run dev`. Os comandos e configurações completos estão em [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

A versão hospedada usa a infraestrutura Sites, Cloudflare Workers, D1 e R2. A autenticação depende da identidade verificada pela hospedagem. Fora desse ambiente, implemente uma autenticação verificada no servidor antes de disponibilizar rotas privadas; não aceite cabeçalhos de identidade enviados pelo cliente.

A integração Stripe está preparada, mas a cobrança não está ativada na versão publicada. Chaves, preços, webhook e validação do provedor precisam ser configurados pelo responsável. O arquivo `.env.example` contém somente os nomes das configurações, sem credenciais.

## Segurança e direitos

Nenhum banco de dados, credencial ou chave de assinatura faz parte deste repositório. Veja [SECURITY_REVIEW.md](SECURITY_REVIEW.md) para as verificações e limitações registradas e [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) para os componentes de terceiros.

A publicação do código não concede uma licença geral de reutilização da marca ou do código próprio. As dependências mantêm suas respectivas licenças.
