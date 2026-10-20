import {useState} from 'react';
import StaffShell from '../../components/StaffShell';
export default function Solicitar(){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 async function send(event){
  event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
  const f=new FormData(event.currentTarget);
  try{
   const r=await fetch('/api/operacao/solicitar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(f)),signal:AbortSignal.timeout(15000)});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível registrar.');
   setNotice(d.message);event.currentTarget.reset();
  }catch(e){setError(e.message||'Serviço temporariamente indisponível.');}finally{setBusy(false);}
 }
 return <StaffShell title="Solicitar acesso à equipe">
  <p>Preencha seus dados. A Gestão Geral confere sua solicitação, aprova sua função e entrega seu convite pessoal para definir senha.</p>
  <form onSubmit={send}>
   <label>Nome completo<input name="name" autoComplete="name" maxLength={120} required/></label>
   <label>E-mail<input name="email" type="email" autoComplete="email" maxLength={254} required/></label>
   <label>WhatsApp com DDD<input name="whatsapp" type="tel" autoComplete="tel" placeholder="(77) 99999-9999" maxLength={24} required/></label>
   <label>Função desejada<select name="role" defaultValue="" required>
    <option value="" disabled>Selecione sua função</option>
    <option value="guias">Guia</option>
    <option value="coordenacao">Coordenação</option>
    <option value="caixa">Caixa</option>
    <option value="apoio">Apoio</option>
    <option value="portaria">Portaria</option>
   </select></label>
   <small>A solicitação não dá acesso automático e não cria ingressos ou pagamentos.</small>
   {error&&<p role="alert" className="error">{error}</p>}
   {notice&&<p role="status">{notice}</p>}
   <button disabled={busy} type="submit">{busy?'Enviando…':'Solicitar cadastro'}</button>
  </form>
  <a href="/operacao/login">← Voltar ao login</a>
 </StaffShell>;
}
