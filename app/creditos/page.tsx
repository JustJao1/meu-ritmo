import ContextIllustration from '../../components/context-illustration';
export default function Page() {
  return <main className="legalpage">
    <header><a className="brand" href="/">Meu Ritmo</a></header>
    <ContextIllustration context="Créditos"/>
    <h1>Créditos e licenças</h1>
    <h2>Desenhos do aplicativo</h2>
    <p>Composição, formas em CSS e favicon preparados para o Meu Ritmo. A distribuição não inclui fotografias de bancos de imagens.</p>
    <h2>Ícones</h2>
    <p>Lucide Icons e seus colaboradores. <a href="/licenses/lucide.txt">Licença ISC e créditos do Feather (MIT)</a>.</p>
    <h2>Tipografia</h2>
    <p>Open Sans, com arquivos servidos pelo próprio site. <a href="/fonts/LICENSE.txt">Licença e créditos originais</a>.</p>
    <h2>Bibliotecas e componentes de terceiros</h2>
    <p>O Meu Ritmo utiliza componentes de software de terceiros, sujeitos às respectivas licenças. <a href="/licenses/shadcn-tailwind.txt">Licença MIT do CSS shadcn</a>.</p>
    <p><a href="/licenses/npm-inventory.txt">Inventário de dependências por versão, licença declarada e origem</a>. A lista inclui dependências de desenvolvimento e opcionais; não representa exclusivamente o código entregue ao navegador. Os direitos e licenças dos componentes continuam pertencendo aos respectivos titulares.</p>
    <h2>Fotos da comunidade</h2>
    <p>Cada participante deve usar imagens próprias ou autorizadas. Se identificar uso indevido, denuncie o conteúdo ou utilize o contato do responsável em Privacidade.</p>
    <p><a href="/privacidade">Privacidade e contato</a> · <a href="/">Voltar ao início</a></p>
  </main>
}
