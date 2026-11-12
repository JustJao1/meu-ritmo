'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="registration"><h1>Não foi possível abrir esta área.</h1><p>Tente novamente. Se continuar, volte ao início e consulte o atendimento.</p><button className="primary" onClick={reset}>Tentar novamente</button><p><a href="/">Voltar ao início</a></p></main>}
