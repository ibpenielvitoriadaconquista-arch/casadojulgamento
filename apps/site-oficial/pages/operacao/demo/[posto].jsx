import OperationTraining from '../../../components/OperationTraining';
import RehearsalPanel from '../../../components/RehearsalPanel';
import {getDemoActor} from '../../../lib/demo-auth';
import Head from 'next/head';
import {useState} from 'react';
const titles={portaria:'Portaria',coordenacao:'Coordenação',guias:'Guias',apoio:'Apoio',caixa:'Caixa'};
export async function getServerSideProps({req,res,params}){
 res.setHeader('Cache-Control','private, no-store');
 const user=getDemoActor(req);
 if(!user)return {redirect:{destination:'/operacao/demo',permanent:false}};
 if(params.posto!==user.role||!titles[params.posto])return {redirect:{destination:'/operacao/demo/'+user.role,permanent:false}};
 return {props:{role:user.role}};
}
function DemoCaixa(){
 const [session,setSession]=useState('09/11/2026 · 17h'),[quantity,setQuantity]=useState(1),[name,setName]=useState(''),[method,setMethod]=useState('Even3'),[tickets,setTickets]=useState([]);
 const options=['09/11/2026 · 17h','13/11/2026 · 20h','14/11/2026 · 18h','19/11/2026 · 20h','20/11/2026 · 17h','21/11/2026 · 18h'];
 return <main className="wrap"><h1>Caixa · balcão e tablet</h1><p>DEMONSTRAÇÃO — nenhuma compra, Pix, dinheiro ou ingresso verdadeiro é criado.</p>
 <form onSubmit={e=>{e.preventDefault();setTickets(x=>[{name,session,quantity,method,id:x.length+1},...x]);setName('');}}>
 <label>Data<select value={session} onChange={e=>setSession(e.target.value)}>{options.map(o=><option key={o}>{o}</option>)}</select></label>
 <label>Nome (fictício)<input required minLength={2} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Participante de teste"/></label>
 <label>Quantidade<input type="number" min="1" max="20" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label>
 <label>Pagamento pretendido<select value={method} onChange={e=>setMethod(e.target.value)}><option>Even3</option><option>Pix</option><option>Dinheiro</option></select></label>
 <button>Simular atendimento</button></form>
 <h2>Atendimentos simulados</h2>{tickets.length? tickets.map(t=><article key={t.id}>{t.name} · {t.session} · {t.quantity} ingresso(s) · {t.method} · NÃO PAGO</article>):<p>Sem atendimentos nesta demonstração.</p>}
 <style jsx>{`.wrap{min-height:100vh;background:#13131d;color:#fff;padding:35px;max-width:100%;font:16px system-ui}form{display:grid;gap:18px;max-width:550px}label{display:grid;gap:7px}input,select{padding:13px;background:#252433;color:#fff;border:1px solid #665660;border-radius:9px}button{padding:15px;background:#b43d49;color:white;border:0;border-radius:9px}article{padding:14px;border-bottom:1px solid #55444a}p{color:#e8bbc5}`}</style></main>;
}
export default function PainelDemo({role}){
 return <><Head><title>DEMO · {titles[role]} · Casa do Julgamento</title><meta name="robots" content="noindex,nofollow"/></Head>
 <div style={{background:'#522630',color:'#fff',padding:'11px 18px',fontFamily:'system-ui',fontSize:13,display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
 <b>DEMONSTRAÇÃO — sem ligação a vendas e entradas reais</b><a style={{color:'#fff'}} href="/operacao/demo">Trocar conta de demonstração ↗</a></div>
 {role==='caixa'?<DemoCaixa/>:role==='apoio'?<RehearsalPanel remote={false}/>:<OperationTraining role={role} remote={false}/>}
 </>;
}