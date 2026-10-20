import {useState} from 'react';
import StaffShell from '../../components/StaffShell';
export default function Recuperar(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function send(e){
  e.preventDefault();setBusy(true);setError('');
  const email=String(new FormData(e.currentTarget).get('email')||'');
  try{
   const r=await fetch('/api/operacao/recuperar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email}),signal:AbortSignal.timeout(15000)});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível solicitar o link.');setMessage(d.message);
  }catch(e){setError(e.message||'Conexão indisponível.');}finally{setBusy(false);}
 }
 return <StaffShell title="Recuperar acesso">
 <p>Informe o e-mail registrado para receber um link de redefinição. O acesso ao painel continuará sujeito à aprovação da Gestão Geral.</p>
 <form onSubmit={send}>
  <label>Seu e-mail<input name="email" type="email" required autoComplete="email"/></label>
  {error&&<p role="alert" className="error">{error}</p>}
  {message&&<p role="status">{message}</p>}
  <button disabled={busy}>{busy?'Enviando…':'Enviar link de recuperação'}</button>
 </form><a href="/operacao/login">← Voltar ao login</a>
 </StaffShell>;
}
