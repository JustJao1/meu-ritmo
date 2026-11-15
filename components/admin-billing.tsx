'use client';
import {useEffect,useState} from 'react';
import {RefreshCw,ReceiptText,AlertTriangle,Headset,ShieldCheck,Inbox,Filter} from 'lucide-react';
import {useLocale} from './language-selector';

type Order={id:string;email:string|null;plan_code:string;status:string;first_price_cents:number;base_price_cents:number;paid_cents:number;payment_count:number;created_at:number;cancelled_at:number|null;first_paid_at:number|null};
type Summary={total_orders:number;active_orders:number;pending_orders:number;review_orders:number;cancelled_orders:number};
type Data={summary:Summary;orders:Order[]};
const money=(cents:number,locale:string)=>new Intl.NumberFormat(locale,{style:'currency',currency:'BRL'}).format((cents||0)/100);
const statusLabel:Record<string,string>={active:'Ativa',pending:'Aguardando pagamento',creating:'Criando',review:'Conferência necessária',cancelled:'Renovação cancelada'};

export default function AdminBilling({onSupport}:{onSupport:()=>void}){
  const {t,locale}=useLocale();
  const [data,setData]=useState<Data|null>(null);
  const [error,setError]=useState(''),[loading,setLoading]=useState(false),[filter,setFilter]=useState('all');
  async function refresh(){
    setLoading(true);setError('');
    try{
      const res=await fetch('/api/admin/billing',{cache:'no-store'});
      const json=await res.json() as Data&{error?:string};
      if(!res.ok)throw Error(json.error||'Não foi possível carregar as cobranças.');
      setData(json);
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível consultar cobranças.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{void refresh()},[]);
  const orders=(data?.orders||[]).filter(o=>filter==='all'||(filter==='review'?['creating','review'].includes(o.status):o.status===filter));
  const s=data?.summary;
  const metrics=[
    {key:'total',label:'Pedidos registrados',value:s?.total_orders},
    {key:'active',label:'Ativos',value:s?.active_orders},
    {key:'pending',label:'Aguardando pagamento',value:s?.pending_orders},
    {key:'review',label:'Em conferência',value:s?.review_orders},
    {key:'cancelled',label:'Cancelados',value:s?.cancelled_orders}
  ];
  return <section className="adminbilling">
    <div className="adminsectionintro billing-intro">
      <div><h2>{t('Cobranças e assinaturas')}</h2>
        <p>{t('Visão de leitura dos últimos 100 pedidos. A ativação do plano depende do pagamento confirmado pelo Asaas. Nenhum dado de cartão aparece aqui.')}</p>
      </div>
    </div>

    <div className="billing-metrics" aria-label={t('Resumo das cobranças')}>
      {metrics.map(m=><div className="billing-metric" key={m.key}>
        <span>{t(m.label)}</span><strong>{m.value??'—'}</strong>
      </div>)}
    </div>

    <div className="billing-toolbar">
      <label className="billing-filter" htmlFor="billing-status-filter">
        <span><Filter size={16} aria-hidden="true"/>{t('Filtrar cobranças')}</span>
        <select id="billing-status-filter" value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">{t('Todas')}</option><option value="active">{t('Ativas')}</option>
          <option value="pending">{t('Aguardando pagamento')}</option><option value="review">{t('Conferência necessária')}</option>
          <option value="cancelled">{t('Renovação cancelada')}</option>
        </select>
      </label>
      <div className="billing-actions">
        <button type="button" className="secondary billing-refresh" disabled={loading} onClick={()=>void refresh()}>
          <RefreshCw size={16} aria-hidden="true"/>{loading?t('Atualizando…'):t('Atualizar')}
        </button>
        <button type="button" className="secondary billing-support" onClick={onSupport}>
          <Headset size={17} aria-hidden="true"/>{t('Atendimento e solicitações')}
        </button>
      </div>
    </div>

    {error&&<div className="billing-alert" role="alert"><AlertTriangle size={18}/><span>{error}</span>
      <button type="button" onClick={()=>void refresh()} disabled={loading}>{t('Tentar novamente')}</button></div>}
    {s&&s.review_orders>0&&<div className="billing-alert" role="status"><AlertTriangle size={18}/>
      <span>{t('Existem pedidos que precisam de conferência no painel do Asaas antes de uma nova tentativa de cobrança.')}</span>
    </div>}

    <div className="billing-results" aria-live="polite">
      {loading&&!data?<div className="billing-empty"><span className="billing-empty-icon"><ReceiptText size={25}/></span>
          <h3>{t('Carregando cobranças…')}</h3>
        </div>:!data&&error?null:orders.length>0?
        <div className="billing-orders">
          {orders.map(o=><article key={o.id} className="billing-order">
            <span className="billing-order-icon"><ReceiptText size={19}/></span>
            <div className="billing-order-account"><strong>{o.email||t('Conta não localizada')}</strong>
              <small>{o.id}</small>
              <small>{new Date(o.created_at*1000).toLocaleString(locale,{timeZone:'America/Sao_Paulo'})}</small>
            </div>
            <div className="billing-order-status">
              <span className="accesspill">{o.plan_code.replace('_month',' / mensal').replace('_year',' / anual')}</span>
              <small>{t(statusLabel[o.status]||o.status)}</small>
            </div>
            <div className="billing-order-values">
              <strong>{t('Primeira cobrança')}: {money(o.first_price_cents,locale)}</strong>
              <small>{t('Renovação')}: {money(o.base_price_cents,locale)}</small>
              <small>{t('Pagamentos confirmados')}: {money(o.paid_cents,locale)} · {o.payment_count} {t('faturas registradas')}</small>
            </div>
          </article>)}
        </div>:<div className="billing-empty">
          <span className="billing-empty-icon"><Inbox size={26} aria-hidden="true"/></span>
          <h3>{t(filter==='all'?'Nenhuma cobrança registrada ainda.':'Nenhum pedido encontrado neste filtro.')}</h3>
          <p>{t(filter==='all'?'As assinaturas aparecerão aqui quando os primeiros pedidos forem registrados.':'Tente selecionar outra situação para consultar os pedidos registrados.')}</p>
          {filter!=='all'&&<button type="button" className="secondary" onClick={()=>setFilter('all')}>{t('Ver todas as cobranças')}</button>}
        </div>}
    </div>
    <div className="billing-footnote"><ShieldCheck size={18} aria-hidden="true"/>
      <p>{t('Esta tela não executa estornos nem altera cobranças. Confira o Asaas e os protocolos de atendimento antes de qualquer ajuste financeiro.')}</p>
    </div>
  </section>;
}
