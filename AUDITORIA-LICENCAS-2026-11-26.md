# Auditoria de licenças e atribuições — 26/11/2026

Projeto: meu-ritmo. Responsável declarado: João Victor da Silva (JustJao1).

Revisão documental dos arquivos acessíveis no GitHub. Preserva os avisos existentes e os direitos de terceiros; não concede nova licença ao código próprio nem certifica conformidade integral. Nenhuma alteração em código executável ou contrato de serviço.

## Escopo e inventário
- Fonte local Open Sans: os créditos e Apache-2.0 estão em public/fonts/LICENSE.txt; nomes CSS não alteram a autoria da fonte.
- Ícones lucide-react: aviso ISC em public/licenses/lucide.txt.
- [Inventário npm por versão e licença](AUDITORIA-NPM-2026-11-26.md): 893 entradas do lockfile, nenhuma sem campo license. 743 MIT, 45 Apache-2.0, 33 ISC, 28 MPL-2.0, 10 LGPL-3.0-or-later, 3 Apache-2.0 AND LGPL-3.0-or-later, 2 Apache-2.0 AND LGPL-3.0-or-later AND MIT; demais: BSD, CC0, CC-BY-4.0, Python-2.0, BlueOak e expressões alternativas/conjuntas. Contagens por entrada, não por pacote único.
- MPL-2.0: se houver distribuição de arquivos cobertos, inclusive JS minificado, preservar aviso e fornecer acesso ao código-fonte coberto conforme a licença: https://www.mozilla.org/en-US/MPL/2.0/FAQ/
- LGPL: as dependências opcionais sharp/libvips exigem revisar a forma de distribuição, licenças, disponibilização de fonte/relink conforme aplicável. Não presumir que todas as entradas são entregues ao usuário: inspecionar o bundle de produção antes de redistribuir. CC-BY-4.0 exige atribuição aplicável.
- Cloudflare, Supabase, Asaas e outros serviços possuem termos próprios. Conteúdo de usuários não pertence ao projeto.
- Pendência: conferir textos originais dos pacotes efetivamente distribuídos, construir inventário do bundle real e disponibilizar créditos e textos completos onde exigido. Este relatório não certifica conformidade integral.

A tag autoria-2026-11-26 foi consultada na API GitHub: assinatura válida (verified=true, reason=valid), apontando para a versão documentada em EVIDENCIA-2026-11-26.md. A auditoria atual é posterior à versão assinada; seu commit não foi assinado com a chave pessoal do mantenedor.
