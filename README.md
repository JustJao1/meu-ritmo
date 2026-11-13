# Meu Ritmo

Seu dia, suas contas e suas ideias em um lugar só. Desenvolvido por João Victor.

Aplicação independente de organização pessoal com Hoje, agenda, rotina, gastos, notas, recados, lembretes, alarmes, comunidade, planos e administração. Login por e-mail e senha no Supabase, servidor Cloudflare Workers e dados de organização em D1. Não usa serviços de IA, identidade externa da ferramenta de desenvolvimento nem hospedagem vinculada a ela.

## Desenvolvimento

Node.js 22.13 ou superior. Execute `npm ci`, `npm run db:local`, `npm run dev`. Use `.dev.vars` para as configurações locais listadas em `.env.example`. O arquivo de exemplo não contém credenciais. Cookies de sessão são Secure e exigem HTTPS para autenticação real; não enfraqueça o cookie em produção.

Verificações: `npm run typecheck`, `npm test` e `npm run build`.

## Publicação independente

1. Crie um banco D1 na sua própria conta Cloudflare e configure o binding DB no `wrangler.jsonc`, com o ID real. O ID vazio de exemplo não é um banco funcional.
2. No Supabase, habilite senha por e-mail e confirmação obrigatória. Configure o endereço final do site e SMTP próprio. O remetente padrão tem limites e não atende um lançamento público. Nos modelos de confirmação e recuperação de senha, inclua `{{ .Token }}` para o fluxo por código de 6 a 10 dígitos. Não envie tokens em URLs.
3. Aplique `supabase/avatar-policies.sql` uma vez no projeto. O bucket avatars é privado, aceita PNG de até 512 KB e cada usuário só pode gravar ou apagar na própria pasta. As imagens são visíveis a usuários autenticados da comunidade. Nunca publique a chave service_role.
4. Gere SESSION_ENCRYPTION_KEY com `openssl rand -base64 32`. Guarde como segredo do Worker; não coloque a chave em código ou logs. Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e os demais segredos do `.env.example`.
5. Para administrar, configure ADMIN_OWNER_EMAIL e ADMIN_OWNER_USER_ID com e-mail confirmado e UUID da sua conta no Supabase. Um nome de perfil ou e-mail enviado no formulário não concede administração.
6. Publique com `npm run deploy` em ambiente autorizado, com as variáveis CLOUDFLARE_* configuradas. O script aplica migrações, compila e publica; depois grava os segredos no Worker. Durante o intervalo de configuração, o login falha fechado. Não anuncie o site antes de testar os fluxos reais.
7. Para encerramento definitivo de login, configure SUPABASE_SERVICE_ROLE_KEY exclusivamente no servidor. Sem ela, a interface permite excluir dados ou solicitar atendimento, mas não afirma ter excluído o login. Configure Stripe e webhook assinado separadamente antes de ativar cobranças.

O projeto pode começar nas franquias gratuitas dos provedores; limites de requisições, CPU, banco, armazenamento e e-mail continuam aplicáveis. Não há contratação de plano pago automática neste projeto.

## Alarmes e lembretes

Alarmes independentes, lembretes com som opcional, pausa, recorrência e adiamento de dez minutos. Ative o som em cada aba. No navegador, a aba precisa estar aberta e o dispositivo ativo. Não há push agendado no servidor; a central explica essa limitação. O [APK Lite](https://github.com/JustJao1/meu-ritmo-lite/releases/tag/v0.1.1-dev) mantém alarmes nativos do Android e funciona offline, sem login.

## Migração e validação

Não apague a versão antiga antes de exportar seus dados e testar a versão nova. O novo provedor gera identificadores de conta diferentes. Não associe automaticamente contas por nome ou e-mail: transfira apenas dados cujo proprietário tenha sido verificado. O APK e sua chave de assinatura não foram alterados nesta migração.

Os testes locais cobrem isolamento, permissões, dados, cupons, recorrências, alarmes e sessões. Confirmação/recuperação via e-mail, Storage, SMTP, pagamento real e limites de CPU precisam de validação na hospedagem configurada. O código pronto para implantação não significa que o domínio já foi migrado.

## Direitos

A publicação do código não concede licença geral de reutilização do código próprio ou da marca. Dependências mantêm suas licenças em THIRD_PARTY_NOTICES.md. Chaves de assinatura, senhas e dados pessoais ficam fora do repositório.
