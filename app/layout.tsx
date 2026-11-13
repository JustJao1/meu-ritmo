import type { Metadata } from 'next';
import './globals.css';
import './public-theme-audit.css';
import './landing-refinement.css';
import './app-visual-consistency.css';
import './typography-refinement.css';
import './font-global-fix.css';
import './workspace-redesign.css';
import './internal-pages-audit.css';
import './theme-contrast-audit.css';
import './forms-dialogs-audit.css';
import './public-header-refinement.css';
import './admin-theme-spacing.css';
import './mobile-usability.css';
import Analytics from '../components/analytics';
import CookieConsent from '../components/cookie-consent';
export const metadata:Metadata={title:'Mr: Meu ritmo · Seu dia em boa companhia',description:'Seu dia, suas contas e suas ideias em um lugar só.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'Mr: Meu Ritmo',statusBarStyle:'default'},icons:{apple:[{url:'/favicon-mr-v3.png',sizes:'64x64'}],icon:[{url:'/favicon-mr-v3.svg',type:'image/svg+xml'},{url:'/favicon-mr-v3.png',type:'image/png',sizes:'64x64'}],shortcut:'/favicon-mr-v3.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body><a className="skiplink" href="#conteudo">Pular para o conteúdo</a><div id="conteudo" tabIndex={-1}>{children}</div><CookieConsent/><Analytics/></body></html>}
