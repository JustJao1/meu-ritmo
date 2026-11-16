type Props={name:string;size?:number};
export default function CategoryIllustration({name,size=24}:Props){
 const paths:Record<string,string>={
 'Hoje':'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0',
 'Agenda':'M5 5h14v15H5zM5 9h14M8 3v4m8-4v4M8 12h2m4 0h2m-8 4h2m4 0h2',
 'Gastos':'M4 7h15v13H4zM5 7V4h12v3m-1 5h5v4h-5z',
 'Notas':'M5 3h12v18H5zM8 7h6m-6 4h5m-5 4h3m4 4 5-9 2 1-5 9-3 1z',
 'Rotina':'M3 5l2 2 3-4m3 2h10M3 12l2 2 3-4m3 2h10M3 19l2 2 3-4m3 2h10',
 'Comunidade':'M9 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0m11 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0M1 21v-4c0-5 10-5 10 0v4m2 0v-4c0-5 10-5 10 0v4',
 'Planos':'M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4zM15 7v3m0 4v5',
 'Administração':'M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6zM8 12l3 3 5-6',
 'Meu Ritmo App':'M7 2h10v20H7zM10 5h4m-3 14h2M3 9v8m18-8v8',
 'Opiniões e respostas':'M3 4h18v13H9l-6 5zM7 8h10M7 12h7',
 'Alarmes e lembretes':'M6 17V9a6 6 0 0 1 12 0v8l2 2H4zM10 22h4M12 1v2',
 'Guia e ajuda':'M5 3c3-1 5 0 7 2 2-2 4-3 7-2v17c-3-1-5 0-7 2-2-2-4-3-7-2zM12 5v17M8 8h1m6 0h1',
 'Meu estilo':'M4 17 14 3l6 4L10 21H4zM12 6l6 4M4 17l6 4',
 'Configurações':'M3 6h18M3 12h18M3 18h18M7 3v6m10 0v6m-7 0v6'
 };
 const aliases:Record<string,string>={'Contas':'Comunidade','Administradores':'Administração','Códigos':'Planos','Acessos':'Planos','Opiniões':'Opiniões e respostas','Histórico':'Notas','Descontos':'Planos','Moderação':'Administração','Lançamento':'Rotina','Cobranças':'Gastos'};
 return <svg className="category-illustration" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><rect x="1" y="1" width="22" height="22" rx="7" fill="var(--accent)" opacity=".1"/><path d={paths[name]||paths[aliases[name]]||paths['Administração']} stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
