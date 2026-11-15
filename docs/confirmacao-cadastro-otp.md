# Confirmação de cadastro por código no Supabase

O cadastro do Meu Ritmo usa a API do Supabase Auth `/signup` e confirma o código com `/verify` (`type: "signup"`). O código de seis dígitos só será enviado se o projeto Supabase estiver configurado com a variável `{{ .Token }}` em **Authentication → Email Templates → Confirm sign up**.

## Modelo a aplicar nos dois projetos

1. Abra https://supabase.com/dashboard e selecione o projeto Supabase da **produção** do Meu Ritmo.
2. Abra **Authentication → Email Templates → Confirm sign up**.
3. Coloque o assunto `Seu código de confirmação - Meu Ritmo`.
4. Substitua o corpo HTML existente pelo conteúdo de [supabase/templates/confirm-signup-otp.html](../supabase/templates/confirm-signup-otp.html) e salve.
5. Repita **no projeto diferente de Sandbox**. A alteração em um projeto não altera o outro.
6. Não altere o modelo **Reset password**, pois o processo de recuperação usa outro fluxo.
7. Cadastre-se com um e-mail de teste ainda não registrado e confira se a mensagem contém o código numérico em vez do link. Em cadastro ainda não confirmado, use **Reenviar código de confirmação** na página `/confirmar-email`.

Nunca troque o campo `{{ .Token }}` por um código literal nem por `{{ .TokenHash }}` ou `{{ .ConfirmationURL }}`. Não desative a exigência de confirmação de e-mail. A aplicação não lê nem armazena o código: o Supabase faz a validação. Os dois ambientes precisam ter seu próprio modelo configurado no painel do Supabase.

Fonte: https://supabase.com/docs/guides/auth/auth-email-templates
