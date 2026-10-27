import {useRef,useState} from 'react';
import Link from 'next/link';
import ops from '../lib/operation-training.cjs';
import caravans from '../lib/caravans.cjs';
export default function Caravana(){
 const [form,setForm]=useState({session:caravans.DAYS[0],name:'',city:'',responsible:'',contact:'',eta:'',members:[{name:'',phone:''}]}),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[done,setDone]=useState(false);
 const requestId=useRef('');
 const field=(key,value)=>setForm(f=>({...f,[key]:value}));
 const member=(i,key,value)=>setForm(f=>({...f,members:f.members.map((m,n)=>n===i?{...m,[key]:value}:m)}));
 async function send(e){e.preventDefault();if(busy)return;requestId.current||=crypto.randomUUID();setBusy(true);setNotice('');try{const r=await fetch('/api/caravana-solicitacao',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,requestId:requestId.current})}),d=await r.json();if(!r.ok)throw Error(d.error);setNotice(d.message);setDone(true);}catch(e){setNotice(e.message||'Não foi possível enviar.');}finally{setBusy(false);}}
 return <main className="container narrow"><Link href="/">← Voltar ao site</Link><h1>Organize sua caravana</h1><p>Envie a lista para a equipe da Casa do Julgamento. Não é necessário e-mail para cada integrante.</p><p className="notice">O envio não confirma vagas nem pagamento. Nossa equipe entrará em contato para conferir a disponibilidade e orientar o pagamento.</p>
 {done?<p role="status">{notice}</p>:<form onSubmit={send} style={{display:'grid',gap:14}}>
 <label>Data da apresentação<select value={form.session} onChange={e=>field('session',e.target.value)}>{ops.SESSIONS.filter(s=>caravans.enabled(s.id)).map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
 <label>Nome da caravana<input required maxLength={100} value={form.name} onChange={e=>field('name',e.target.value)}/></label><label>Cidade de origem<input required maxLength={100} value={form.city} onChange={e=>field('city',e.target.value)}/></label><label>Nome do responsável<input required maxLength={100} value={form.responsible} onChange={e=>field('responsible',e.target.value)}/></label><label>Telefone do responsável com DDD<input required type="tel" maxLength={24} value={form.contact} onChange={e=>field('contact',e.target.value)}/></label><label>Chegada prevista (opcional)<input type="time" value={form.eta} onChange={e=>field('eta',e.target.value)}/></label>
 <h2>Integrantes ({form.members.length}/25)</h2>{form.members.map((m,i)=><div key={i} style={{display:'grid',gap:8,borderTop:'1px solid #777',paddingTop:12}}><label>Nome do integrante {i+1}<input required maxLength={150} value={m.name} onChange={e=>member(i,'name',e.target.value)}/></label><label>Telefone com DDD (opcional)<input type="tel" maxLength={24} value={m.phone} onChange={e=>member(i,'phone',e.target.value)}/></label>{form.members.length>1&&<button type="button" onClick={()=>field('members',form.members.filter((_,n)=>i!==n))}>Remover integrante</button>}</div>)}
 <button type="button" disabled={form.members.length>=25} onClick={()=>field('members',[...form.members,{name:'',phone:''}])}>Adicionar integrante</button><p>Para mais de 25 pessoas, envie listas separadas. A equipe confirmará as vagas.</p><button type="submit" disabled={busy}>{busy?'Enviando…':'Enviar solicitação'}</button>{notice&&<p role="alert">{notice}</p>}</form>}
 <style jsx>{'label{display:grid;gap:6px}input,select,button{font:inherit;padding:10px;max-width:100%}button{cursor:pointer}'}</style></main>;
}
