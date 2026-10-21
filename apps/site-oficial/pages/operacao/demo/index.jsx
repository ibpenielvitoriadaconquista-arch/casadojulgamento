import {useState} from 'react';
import Head from 'next/head';
export default function Demonstracao(){
 const [email,setEmail]=useState('testeportaria@gmail.com');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function login(e){e.preventDefault();setBusy(true);setError('');try{
  const r=await fetch('/api/operacao/demo-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(12000)});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Dados inválidos.');
  location.assign('/operacao/demo/'+d.role);
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 return <><Head><title>Apresentação dos painéis | Casa do Julgamento</title><meta name="robots" content="noindex,nofollow"/></Head>
 <main className="shell"><div className="panel"><span className="tag">CASA DO JULGAMENTO 2026</span><h1>Apresentação dos painéis</h1>
 <p>Ambiente demonstrativo no site oficial. <strong>Não registra compras, pagamentos ou entradas reais.</strong> Os dados são fictícios e ficam somente neste navegador.</p>
 <form onSubmit={login}>
 <label>Conta para apresentar<select value={email} onChange={e=>setEmail(e.target.value)}>
 <option value="testeportaria@gmail.com">testeportaria@gmail.com — Portaria</option>
 <option value="testecoordenacao@gmail.com">testecoordenacao@gmail.com — Coordenação</option>
 <option value="testeguia@gmail.com">testeguia@gmail.com — Guias</option>
 <option value="testeapoio@gmail.com">testeapoio@gmail.com — Apoio</option>
 <option value="testecaixa@gmail.com">testecaixa@gmail.com — Caixa</option>
 </select></label>
 <label>Senha de demonstração<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="off"/></label>
 {error&&<p role="alert" className="error">{error}</p>}
 <button disabled={busy} type="submit">{busy?'Entrando…':'Abrir painel demonstrativo →'}</button>
 </form>
 <p className="note">Os logins operacionais permanecem na <a href="/operacao/login">área oficial de colaboradores</a>, com convites individuais.</p></div></main>
 <style jsx>{`.shell{min-height:100vh;background:#111019;color:#f6eced;display:grid;place-items:center;padding:20px;font:16px system-ui}.panel{max-width:560px;width:100%;border-radius:18px;background:#241c26;border:1px solid #534451;padding:32px}h1{font-size:32px}.tag{font-size:11px;letter-spacing:2px;color:#f0b0a5}p{line-height:1.6;color:#e2ced4}form{display:grid;gap:18px;margin:25px 0}label{display:grid;gap:8px;font-size:13px}input,select{padding:15px;min-height:50px;background:#100f17;color:#fff;border:1px solid #75636b;border-radius:10px;font-size:16px;max-width:100%}button{padding:16px;border-radius:10px;background:#b43f4c;border:1px solid #e76675;color:white;font-weight:bold;font-size:16px;cursor:pointer}button:disabled{opacity:.6}a{color:#eebeb4}.note{font-size:13px}.error{color:#ffb2b6}`}</style></>;
}