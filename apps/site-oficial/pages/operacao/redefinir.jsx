import {useEffect,useState} from 'react';
import StaffShell from '../../components/StaffShell';
export default function Redefinir(){
 const [tokens,setTokens]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 useEffect(()=>{
  const p=new URLSearchParams(window.location.hash.slice(1));
  const accessToken=p.get('access_token'),refreshToken=p.get('refresh_token');
  const tokenHash=p.get('token_hash'),type=p.get('type');
  if(accessToken&&refreshToken&&type==='recovery')setTokens({accessToken,refreshToken});
  else if(tokenHash&&type==='recovery')setTokens({tokenHash,type});
  else setError('Link de recuperação ausente ou inválido. Solicite um novo.');
  window.history.replaceState({},'',window.location.pathname);
 },[]);
 async function send(e){
  e.preventDefault();if(!tokens||busy)return;
  setBusy(true);setError('');
  const f=new FormData(e.currentTarget),password=String(f.get('password')||'');
  if(password!==f.get('confirmation')){setError('As senhas precisam ser iguais.');setBusy(false);return;}
  try{
   const r=await fetch('/api/operacao/redefinir',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...tokens,password}),signal:AbortSignal.timeout(15000)});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível redefinir a senha.');
   setTokens(null);setDone(true);
  }catch(err){setError(err.message||'Não foi possível conectar.');}finally{setBusy(false);}
 }
 return <StaffShell title="Redefinir minha senha">
  {done?<><p role="status">Senha alterada. Agora entre com seu e-mail e a nova senha.</p><a href="/operacao/login">Ir para o login →</a></>:
  <><p>Use o link de recuperação enviado ao seu e-mail. Ele é pessoal e tem prazo de validade.</p>
   <form onSubmit={send}>
    <label>Nova senha (mínimo 12 caracteres)<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label>
    <label>Repita a senha<input name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label>
    {error&&<p role="alert" className="error">{error}</p>}
    <button disabled={busy||!tokens}>{busy?'Aguarde…':'Salvar nova senha'}</button>
   </form><a href="/operacao/recuperar">Solicitar outro link</a></>}
 </StaffShell>;
}
