import {useEffect,useRef,useState} from 'react';
import caravans from '../lib/caravans.cjs';

export default function CaravanGate({session,role='portaria',cashier=false}){
 const [data,setData]=useState(null),[search,setSearch]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[online,setOnline]=useState(false);
 const working=useRef(false),sequence=useRef(0);
 useEffect(()=>{
  if(!caravans.enabled(session))return;
  let stopped=false,loading=false;
  async function load(){if(working.current||loading)return;loading=true;const seq=++sequence.current;
   try{const r=await fetch('/api/operacao/caravanas?session='+session,{cache:'no-store',signal:AbortSignal.timeout(10000)}),d=await r.json();if(!r.ok)throw Error(d.error);if(!stopped&&seq===sequence.current){setData(d);setOnline(true);}}
   catch(e){if(!stopped&&seq===sequence.current){setOnline(false);setError(e.message||'Sem conexão. Não libere entradas.');}}finally{loading=false;}}
  load();const timer=setInterval(load,4000);return()=>{stopped=true;++sequence.current;clearInterval(timer);};
 },[session]);
 async function run(action,arg){
  if(working.current||!online||!data)return;working.current=true;++sequence.current;setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/operacao',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session,role,action,arg,revision:data.revision,requestId:crypto.randomUUID()}),signal:AbortSignal.timeout(12000)}),d=await r.json();if(!r.ok)throw Error(d.error);setNotice(d.message);
   const fresh=await fetch('/api/operacao/caravanas?session='+session,{cache:'no-store',signal:AbortSignal.timeout(10000)}),updated=await fresh.json();if(!fresh.ok)throw Error(updated.error);setData(updated);
  }catch(e){setError(e.message||'Resposta não confirmada. Confira a lista antes de repetir.');setOnline(false);}
  finally{working.current=false;setBusy(false);}
 }
 function authorize(c){const method=window.prompt('Recebimento confirmado: dinheiro, pix_igreja, cortesia ou revogar');if(!method)return;const reference=window.prompt('Referência do recebimento ou justificativa da autorização:');if(reference?.trim())run('caravanAuthorize',{id:c.caravanId,method:method.trim().toLowerCase(),reference});}
 if(!caravans.enabled(session))return <p>O cadastro direto de caravanas está disponível nas seis apresentações de novembro.</p>;
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const term=normalize(search.trim()),digits=search.replace(/\D/g,''),phoneSearch=/^[+\d\s().-]+$/.test(search)&&digits.length>0;
 const members=(data?.members||[]).filter(m=>!term||normalize([m.name,m.caravanName,m.city,m.code].join(' ')).includes(term)||(phoneSearch&&[m.phone,m.contact].some(p=>String(p).replace(/\D/g,'').includes(digits))));
 const lists=[...new Map((data?.members||[]).map(m=>[m.caravanId,m])).values()];
 return <section className="caravan-desk"><h2>{cashier?'Autorização de caravanas':'Entrada de caravanas'}</h2>
  <p>Cadastros diretos da igreja, sem consulta à Even3. Confira a identidade da pessoa e a caravana antes de registrar a entrada. Não admita a lista inteira de uma vez.</p>
  {!online&&<p role="status">Aguardando sincronização. Entradas bloqueadas.</p>}{error&&<p role="alert" className="warning">{error}</p>}{notice&&<p role="status" className="success">{notice}</p>}
  {cashier&&lists.map(c=><article key={c.caravanId}><h3>{c.caravanName} · {c.city}</h3><p>{c.date.split('-').reverse().join('/')} · {c.group} · {c.authorized?'Autorizada':'Aguardando autorização'} · {(data?.members||[]).filter(m=>m.caravanId===c.caravanId).length} integrantes</p><button type="button" disabled={busy||!online} onClick={()=>authorize(c)}>Registrar recebimento / autorização</button></article>)}
  <label>Buscar nome, telefone, caravana ou cidade<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ex.: Pedro ou telefone com DDD" autoComplete="off"/></label>
  <p>{members.length} integrante(s) neste filtro · {session.split('-').reverse().join('/')}</p>
  <div className="member-list">{members.map(m=><article key={m.code}><h3>{m.name}</h3><p><b>{m.caravanName}</b> · {m.city}<br/>Dia {m.date.split('-').reverse().join('/')} · Grupo reservado {m.group}<br/>{m.phone?'Telefone: '+m.phone:'Contato do responsável: '+(m.contact||'não informado')}<br/>Responsável: {m.responsible}</p>
   <p className={m.admitted?'success':'warning'}>{m.admitted?'ENTRADA JÁ REGISTRADA':m.authorized?(m.eligible?'Autorizado · aguardando chegada':'Autorizado · entrada somente na data da apresentação'):'Pendente de autorização do Caixa/Gestão'}</p>
   {!cashier&&<button type="button" disabled={busy||!online||!m.eligible} onClick={()=>{if(window.confirm('Conferiu '+m.name+' da caravana '+m.caravanName+'? Registrar somente a entrada desta pessoa?'))run('caravanAdmit',{code:m.code});}}>{m.admitted?'Já entrou':'Registrar entrada e enviar à Coordenação'}</button>}
  </article>)}</div>{online&&!members.length&&<p>Nenhum integrante encontrado nesta data. Confira a busca ou peça à Coordenação para conferir o cadastro.</p>}
  <style jsx>{`.caravan-desk{border:1px solid #70573d;border-radius:12px;background:#1c222b;padding:20px;margin:18px 0;color:#eef2f7}.caravan-desk p{line-height:1.7;font-size:13px;margin:10px 0}.caravan-desk label{display:grid;gap:8px;margin-top:18px}.caravan-desk input{font:inherit;font-size:16px;width:100%;padding:12px;background:#111822;color:#fff;border:1px solid #657082;border-radius:8px;box-sizing:border-box}.member-list{display:grid;gap:12px}.caravan-desk article{padding:16px;border:1px solid #48566a;border-radius:10px;margin:12px 0;overflow-wrap:anywhere}.caravan-desk h3{font-size:17px;margin:0}.caravan-desk button{padding:12px;border:1px solid #bf9c68;border-radius:8px;background:#e4bd86;color:#211b13;cursor:pointer;font:inherit;min-height:44px}.caravan-desk button:disabled{opacity:.45;cursor:not-allowed}.warning{color:#ffd3a1}.success{color:#b1eccb}.caravan-desk :focus-visible{outline:3px solid #f1c78b;outline-offset:3px}`}</style>
 </section>;
}
