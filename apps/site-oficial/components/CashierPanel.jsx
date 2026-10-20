import {useState,useEffect} from 'react';
import Head from 'next/head';
import checkout from '../../lib/even3-checkout.cjs';
export default function CashierPanel(){
 const [form,setForm]=useState({session:'2026-11-09',channel:'balcao',name:'',contact:'',quantity:'1',paymentMethod:'even3',notes:''});
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[created,setCreated]=useState(null),[orders,setOrders]=useState([]);
 async function refresh(){try{const r=await fetch('/api/operacao/caixa',{cache:'no-store'});const j=await r.json();if(r.ok)setOrders(j.orders||[]);}catch{}}
 useEffect(()=>{refresh();},[]);
 async function submit(e){e.preventDefault();if(busy)return;setBusy(true);setNotice('');setError('');setCreated(null);
  try{const r=await fetch('/api/operacao/caixa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form),signal:AbortSignal.timeout(12000)});const j=await r.json();if(!r.ok)throw Error(j.error||'Falha ao registrar atendimento.');setCreated(j);setNotice(j.message);setForm(x=>({...x,name:'',contact:'',notes:''}));refresh();}
  catch(e){setError(e.message||'Falha de comunicação.');}finally{setBusy(false);}
 }
 const change=(key,val)=>setForm(x=>({...x,[key]:val}));
 const session=checkout.ENTRIES.find(x=>x.iso===form.session);
 return <><Head><title>Caixa · Casa do Julgamento 2026</title><meta name="robots" content="noindex,nofollow"/></Head>
 <main className="cash">
 <header><a href="/operacao/login">← Equipe</a><span>CASA DO JULGAMENTO 2026 · CAIXA OFICIAL</span></header>
 <h1>Atendimento de vendas</h1>
 <p className="intro">Registre o atendimento presencial ou com tablet na fila e finalize a compra pela Even3. Não confunda uma anotação de Pix ou dinheiro com ingresso emitido.</p>
 <div className="banner"><strong>Venda não é entrada liberada.</strong> O ingresso precisa existir na Even3 e passar pelas verificações da Portaria.</div>
 <section className="panel"><h2>Novo atendimento</h2>
 <form onSubmit={submit}>
 <div className="pair">
 <label>Onde está atendendo?<select value={form.channel} onChange={e=>change('channel',e.target.value)}><option value="balcao">Balcão da igreja</option><option value="tablet_fila">Tablet na fila</option></select></label>
 <label>Data do ingresso<select value={form.session} onChange={e=>change('session',e.target.value)}>{checkout.ENTRIES.map(x=><option key={x.iso} value={x.iso}>{x.date} · {x.time}</option>)}</select></label>
 </div>
 <div className="pair"><label>Nome do interessado<input value={form.name} maxLength={150} required onChange={e=>change('name',e.target.value)} placeholder="Nome da pessoa atendida"/></label>
 <label>Contato (opcional)<input value={form.contact} maxLength={120} onChange={e=>change('contact',e.target.value)} placeholder="Telefone ou e-mail"/></label></div>
 <div className="pair"><label>Quantidade de ingressos<input type="number" min="1" max="20" value={form.quantity} onChange={e=>change('quantity',e.target.value)} required/></label>
 <label>Como pretende pagar?<select value={form.paymentMethod} onChange={e=>change('paymentMethod',e.target.value)}><option value="even3">Pagamento pela Even3</option><option value="pix_igreja">Pix diretamente à igreja</option><option value="dinheiro">Dinheiro no caixa</option><option value="outro">Outro</option></select></label></div>
 <label>Observação (opcional)<textarea value={form.notes} maxLength={500} onChange={e=>change('notes',e.target.value)} placeholder="Ex.: precisa de ajuda para concluir a compra"/></label>
 <button type="submit" disabled={busy}>{busy?'Registrando…':'Registrar atendimento'}</button>
 {error&&<p role="alert" className="err">{error}</p>}
 {notice&&<p role="status" className="ok">{notice}</p>}
 {created&&<div className="checkout"><strong>Próximo passo: emissão oficial</strong><p>Data: {session?.date} · {session?.time}. O checkout seleciona a data; quantidade e dados pessoais precisam ser conferidos na Even3.</p><a href={created.checkoutUrl} target="_blank" rel="noopener noreferrer">Abrir compra na Even3 →</a><p>Se o pagamento foi diretamente à igreja, permaneça em conferência: a compra na Even3 não pode ser dada como paga automaticamente.</p></div>}
 </form></section>
 <section className="panel"><h2>Atendimentos recentes</h2><p className="small">Registro de acompanhamento, não comprovante de pagamento.</p>
 <div className="list">{orders.map(o=><article key={o.id}><div><strong>{o.participant_name}</strong><small>{o.session_date} · {o.channel==='tablet_fila'?'Tablet':'Balcão'} · {o.intended_quantity} ingresso(s) · {o.payment_method}</small></div><span>Pendente de verificação</span></article>)}</div>
 {!orders.length&&<p>Nenhum atendimento registrado.</p>}<button className="secondary" onClick={refresh}>Atualizar lista</button>
 </section></main>
 <style jsx>{`
 .cash{max-width:900px;margin:auto;padding:24px 18px 70px;font-family:Arial,sans-serif;color:#f5edef}.cash *{box-sizing:border-box}header{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:12px;color:#dcb7bd}a{color:#ffcecf}h1{font-size:clamp(28px,5vw,38px)}h2{font-size:22px}p{line-height:1.6;color:#d6c5c9}.intro{max-width:750px}.banner,.panel{border:1px solid #62454d;background:#241921;border-radius:14px;padding:20px;margin:18px 0}.banner{background:#352329}.panel form{display:grid;gap:17px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}label{display:grid;gap:8px;font-size:13px;font-weight:700}input,select,textarea{width:100%;min-width:0;border:1px solid #7a5a62;border-radius:9px;padding:12px;font:inherit;font-size:16px;color:#fff;background:#130f14}textarea{min-height:78px}button,.checkout a{border:1px solid #e15d64;border-radius:9px;background:#b73d4a;padding:15px;color:white;font:inherit;font-weight:700;cursor:pointer;text-align:center}button:disabled{opacity:.6}.secondary{background:transparent}.err{color:#ffb5b5}.ok{color:#b9eac7}.checkout{background:#172b25;padding:16px;border:1px solid #508368;border-radius:10px}.checkout a{display:inline-block}.small,small{font-size:12px}.list article{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #503b45;padding:15px 0}.list article small{display:block;color:#bda7ae;margin-top:6px}.list article span{color:#ffd6a7;font-size:12px;white-space:nowrap}@media(max-width:650px){.pair{grid-template-columns:1fr}.list article{flex-direction:column}}
 `}</style></>;
}