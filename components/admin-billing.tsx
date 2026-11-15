'use client';
import {useEffect,useState} from 'react';
import {RefreshCw,ReceiptText,AlertTriangle} from 'lucide-react';
import {useLocale} from './language-selector';

type Order={id:string;email:string|null;plan_code:string;status:string;first_price_cents:number;base_price_cents:number;paid_cents:number;payment_count:number;created_at:number;cancelled_at:number|null;first_paid_at:number|null};
type Summary={total_orders:number;active_orders:number;pending_orders:number;review_orders:number;cancelled_orders:number};
type Data={summary:Summary;orders:Order[]};
const money=(cents:number,locale:string)=>new Intl.NumberFormat(locale,{style:'currency',currency:'BRL'}).format((cents||0)/100);
const statusLabel:Record<string,string>={active:'Ativa',pending:'Aguardando pagamento',creating:'Criando',review:'Conferência necessária',cancelled:'Renovação cancelada'};
export default function AdminBilling({onSupport}:{onSupport:()=>void}){
  const {t,locale}=useLocale();
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[filter,setFilter]=useState('all');
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
  return <section className="adminbilling">
    <div className="adminsectionintro"><h2>{t('Cobranças e assinaturas')}</h2><p>{t('Visão de leitura dos últimos 100 pedidos. A ativação do plano depende do pagamento confirmado pelo Asaas. Nenhum dado de cartão aparece aqui.')}</p></div>
    <div className="adminscope"><span><strong>{s?.total_orders??'—'}</strong> {t('pedidos registrados')}</span><span><strong>{s?.active_orders??'—'}</strong> {t('ativos')}</span><span><strong>{s?.pending_orders??'—'}</strong> {t('aguardando pagamento')}</span><span><strong>{s?.review_orders??'—'}</strong> {t('em conferência')}</span><span><strong>{s?.cancelled_orders??'—'}</strong> {t('cancelados')}</span></div>
    <div className="adminsearch"><label>{t('Filtrar cobranças')} <select value={filter} onChange={e=>setFilter(e.target.value)}>
      <option value="all">{t('Todas')}</option><option value="active">{t('Ativas')}</option>
      <option value="pending">{t('Aguardando pagamento')}</option><option value="review">{t('Conferência necessária')}</option>
      <option value="cancelled">{t('Renovação cancelada')}</option>
    </select></label><button type="button" className="secondary" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={15}/>{t('Atualizar')}</button><button type="button" className="secondary" onClick={onSupport}>{t('Atendimento e solicitações')}</button></div>
    {error&&<p className="adminerror" role="alert">{error}</p>}
    {s&&s.review_orders>0&&<p className="warning"><AlertTriangle size={16}/>{t('Existem pedidos que precisam de conferência no painel do Asaas antes de uma nova tentativa de cobrança.')}</p>}
    {loading&&!data?<p className="muted">{t('Carregando cobranças…')}</p>:<div className="memberlist">
    {orders.map(o=><article key={o.id} className="memberrow"><span className="memberavatar"><ReceiptText size={19}/></span>
      <div className="memberdetails"><strong>{o.email||t('Conta não localizada')}</strong><small>{o.id}</small><small>{new Date(o.created_at*1000).toLocaleString(locale,{timeZone:'America/Sao_Paulo'})}</small></div>
      <div className="memberaccess"><span className="accesspill">{o.plan_code.replace('_month',' / mensal').replace('_year',' / anual')}</span>
      <small>{t(statusLabel[o.status]||o.status)}</small></div>
      <div className="memberdetails"><strong>{t('Primeira cobrança')}: {money(o.first_price_cents,locale)}</strong>
      <small>{t('Renovação')}: {money(o.base_price_cents,locale)}</small>
      <small>{t('Pagamentos confirmados')}: {money(o.paid_cents,locale)} · {o.payment_count} {t('faturas registradas')}</small></div>
    </article>)}
    {!orders.length&&<p className="muted">{t('Nenhum pedido encontrado neste filtro.')}</p>}
    </div>}
    <p className="muted">{t('Esta tela não executa estornos nem altera cobranças. Confira o Asaas e os protocolos de atendimento antes de qualquer ajuste financeiro.')}</p>
  </section>;
}
