'use client';

import {createContext,useCallback,useContext,useRef,useState,type ReactNode} from 'react';
import {Dialog as RadixDialog} from 'radix-ui';
import {AlertTriangle,CheckCircle2,HelpCircle,Info,ShieldAlert,X} from 'lucide-react';
import {useLocale} from './language-selector';

export type DialogIntent='default'|'danger'|'warning'|'success';
export type ConfirmOptions={
  title:string;
  description?:string;
  confirmText?:string;
  cancelText?:string;
  intent?:DialogIntent;
};
export type PromptOptions=ConfirmOptions & {
  expectedValue?:string;
  label?:string;
  placeholder?:string;
  initialValue?:string;
  maxLength?:number;
};

type Request=
 |{kind:'confirm';options:ConfirmOptions;resolve:(value:boolean)=>void}
 |{kind:'prompt';options:PromptOptions;resolve:(value:string|null)=>void}
 |{kind:'alert';options:ConfirmOptions;resolve:()=>void};

type DialogApi={
  confirm:(options:ConfirmOptions)=>Promise<boolean>;
  prompt:(options:PromptOptions)=>Promise<string|null>;
  alert:(options:ConfirmOptions)=>Promise<void>;
};

const DialogContext=createContext<DialogApi|null>(null);

export function useAppDialog():DialogApi{
  const context=useContext(DialogContext);
  if(!context)throw new Error('useAppDialog precisa de AppDialogProvider.');
  return context;
}

export function AppDialogProvider({children}:{children:ReactNode}){
  const {t}=useLocale();
  const pending=useRef<Request|null>(null);
  const [active,setActive]=useState<Request|null>(null);
  const [value,setValue]=useState('');

  const confirm=useCallback((options:ConfirmOptions)=>new Promise<boolean>(resolve=>{
    if(pending.current){resolve(false);return;}
    const request:Request={kind:'confirm',options,resolve};
    pending.current=request;setActive(request);setValue('');
  }),[]);
  const prompt=useCallback((options:PromptOptions)=>new Promise<string|null>(resolve=>{
    if(pending.current){resolve(null);return;}
    const request:Request={kind:'prompt',options,resolve};
    pending.current=request;setActive(request);setValue(options.initialValue||'');
  }),[]);
  const alert=useCallback((options:ConfirmOptions)=>new Promise<void>(resolve=>{
    if(pending.current){resolve();return;}
    const request:Request={kind:'alert',options,resolve};
    pending.current=request;setActive(request);setValue('');
  }),[]);

  const finish=useCallback((answer:boolean|string|null)=>{
    const request=pending.current;
    if(!request)return;
    pending.current=null;
    setActive(null);
    setValue('');
    if(request.kind==='confirm')request.resolve(answer===true);
    else if(request.kind==='prompt')request.resolve(typeof answer==='string'?answer:null);
    else request.resolve();
  },[]);

  const intent=active?.options.intent||'default';
  const Icon=intent==='danger'?ShieldAlert:intent==='warning'?AlertTriangle:intent==='success'?CheckCircle2:Info;
  const canSubmit=active?.kind!=='prompt'||(!active.options.expectedValue||value===active.options.expectedValue);
  const isAlert=active?.kind==='alert';

  return <DialogContext.Provider value={{confirm,prompt,alert}}>
    {children}
    <RadixDialog.Root open={!!active} onOpenChange={open=>{if(!open)finish(null)}}>
      {active&&<RadixDialog.Portal>
        <RadixDialog.Overlay className="mr-confirm-overlay"/>
        <RadixDialog.Content className={'mr-confirm-dialog mr-confirm-'+intent}
          aria-describedby={active.options.description?'mr-confirm-description':undefined}
          onOpenAutoFocus={event=>{
            if(active.kind==='prompt'){
              event.preventDefault();
              requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('.mr-confirm-dialog input')?.focus());
            }
          }}>
          <form onSubmit={event=>{
            event.preventDefault();
            if(!canSubmit)return;
            finish(active.kind==='prompt'?value:true);
          }}>
            <div className="mr-confirm-header">
              <span className="mr-confirm-icon" aria-hidden="true"><Icon size={21}/></span>
              <div className="mr-confirm-heading">
                <RadixDialog.Title>{t(active.options.title)}</RadixDialog.Title>
                {active.options.description&&<RadixDialog.Description id="mr-confirm-description">{t(active.options.description)}</RadixDialog.Description>}
              </div>
              <button type="button" className="mr-confirm-close" onClick={()=>finish(null)} aria-label={t('Fechar')}><X size={18}/></button>
            </div>
            {active.kind==='prompt'&&<div className="mr-confirm-body">
              <label htmlFor="mr-confirm-input">{t(active.options.label||'Digite sua confirmação')}</label>
              <input id="mr-confirm-input" type="text" value={value} maxLength={active.options.maxLength||150}
                placeholder={active.options.placeholder?t(active.options.placeholder):undefined}
                autoComplete="off" spellCheck={false} onChange={event=>setValue(event.target.value)}
                aria-describedby={active.options.expectedValue?'mr-confirm-expected':undefined}/>
              {active.options.expectedValue&&<p id="mr-confirm-expected" className="mr-confirm-hint">
                {t('Digite exatamente:')} <strong>{active.options.expectedValue}</strong>
                {value.length>0&&value!==active.options.expectedValue&&<span className="mr-confirm-mismatch"> {t('O texto ainda não confere.')}</span>}
              </p>}
            </div>}
            <div className="mr-confirm-actions">
              {!isAlert&&<button type="button" className="mr-confirm-cancel" onClick={()=>finish(null)}>{t(active.options.cancelText||'Cancelar')}</button>}
              <button type="submit" className="mr-confirm-submit" disabled={!canSubmit}>
                {t(active.options.confirmText||(isAlert?'Entendi':active.kind==='prompt'?'Continuar':'Confirmar'))}
              </button>
            </div>
          </form>
        </RadixDialog.Content>
      </RadixDialog.Portal>}
    </RadixDialog.Root>
  </DialogContext.Provider>;
}
