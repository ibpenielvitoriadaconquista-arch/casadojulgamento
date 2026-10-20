import {useEffect,useState} from 'react';
const roles={guias:'Guia',coordenacao:'Coordenação',caixa:'Caixa',apoio:'Apoio',portaria:'Portaria'};
export default function AccessRequests(){
 const [requests,setRequests]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[link,setLink]=useState(''),[busy,setBusy]=useState('');
 async function load(){
  const r=await fetch('/api/operacao/solicitacoes',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Erro ao carregar solicitações.');
  setRequests(d.requests||[]);
 }
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 async function review(id,action){
  if(busy)return;setBusy(id);setError('');setNotice('');setLink('');
  try{
   const r=await fetch('/api/operacao/solicitacoes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action}),signal:AbortSignal.timeout(20000)});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Falha na avaliação.');
   if(d.link){setLink(d.link);setNotice('Solicitação aprovada. Copie o convite e entregue ao colaborador por canal privado.');}
   else setNotice('Solicitação recusada.');
   await load();
  }catch(e){setError(e.message);}finally{setBusy('');}
 }
 const pending=requests.filter(x=>x.status==='pending');
 return <section style={{marginTop:32}}>
  <h2>Solicitações de primeiro acesso ({pending.length})</h2>
  <p>Revise nome, WhatsApp, e-mail e função. Apenas a Gestão Geral pode aprovar.</p>
  {error&&<p role="alert" className="error">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {link&&<div className="card"><label>Convite individual gerado<textarea readOnly value={link} onFocus={e=>e.target.select()}/></label>
   <button onClick={async()=>{try{await navigator.clipboard.writeText(link);setNotice('Convite copiado.');}catch{setNotice('Selecione e copie o link.');}}}>Copiar convite</button>
   <small>Esse link é pessoal. Não publique em grupos.</small></div>}
  {!pending.length?<p>Nenhuma solicitação pendente.</p>:pending.map(item=><div className="card" key={item.id}>
   <strong>{item.full_name}</strong>
   <small>{item.email} · WhatsApp: {item.whatsapp} · Função: {roles[item.requested_role]||item.requested_role}</small>
   <div className="pair"><button disabled={!!busy} onClick={()=>review(item.id,'approve')}>Aprovar e gerar convite</button>
    <button disabled={!!busy} onClick={()=>review(item.id,'reject')}>Recusar solicitação</button></div>
  </div>)}
 </section>;
}
