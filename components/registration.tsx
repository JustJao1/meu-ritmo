'use client';
import ProfileEditor from './profile-editor';
import {useLocale} from './language-selector';
export default function Registration(){
 const {t}=useLocale();
 return <main className="registration">
  <a className="brand" href="/">Meu Ritmo</a>
  <span className="eyebrow">{t('CONCLUIR CADASTRO')}</span>
  <h1>{t('Como você quer aparecer?')}</h1>
  <p>{t('Escolha seu @usuário e nome de exibição para abrir seu espaço. A bio é opcional. Você poderá adicionar uma foto pelo perfil. Seus dados de organização continuam privados.')}</p>
  <ProfileEditor registration onSaved={()=>{location.href='/app'}} onToast={()=>{}}/>
  <p><a href="/sair?return_to=%2F">{t('Sair e continuar depois')}</a></p>
 </main>;
}
