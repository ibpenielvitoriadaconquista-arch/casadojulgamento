import {useEffect,useState} from 'react';
import StaffShell from '../../components/StaffShell';
import AccessRequests from '../../components/AccessRequests';
import {actor} from '../../lib/operation-auth';
import ops from '../../lib/operation-training.cjs';
export async function getServerSideProps({req,res}){res.setHeader('Cache-Control','private, no-store');try{const u=await actor(req);if(u.role!=='geral')return {redirect:{destination:'/operacao/'+u.role,permanent:false}};return {props:{}};}catch{return {redirect:{destination:'/operacao/login',permanent:false}};}}
function Person({person,self,run,busy}){const [role,setRole]=useState(person.role),[active,setActive]=useState(person.active);return <div className="card"><strong>{person.email}</strong><small>{person.email_confirmed_at?'Conta confirmada':'Aguardando ativação do convite'}</small><div className="pair"><label>Função<select value={role} disabled={self||busy} onChange={e=>setRole(e.target.value)}>{Object.entries(ops.ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label className="check"><input type="checkbox" checked={active} disabled={self||busy} onChange={e=>setActive(e.target.checked)}/> Acesso habilitado</label></div><div className="pair"><button disabled={self||busy} onClick={()=>run({action:'update',userId:person.user_id,role,active})}>Salvar permissões</button><button disabled={busy||!person.active} onClick={()=>run({action:'recovery',email:person.email})}>Gerar link de acesso</button></div>{self&&<small>Esta é sua conta. Outro administrador pode alterar suas permissões.</small>}</div>}
const TEST_CREW=[
 {email:'testeportaria@gmail.com',role:'portaria'},
 {email:'testeguia@gmail.com',role:'guias'},
 {email:'testeapoio@gmail.com',role:'apoio'},
 {email:'testecoordenacao@gmail.com',role:'coordenacao'},
 {email:'testecaixa@gmail.com',role:'caixa'}
];
export default function Team(){const [data,setData]=useState(null),[error,setError]=useState(''),[link,setLink]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [testInvites,setTestInvites]=useState([]);
 async function load(){const r=await fetch('/api/operacao/equipe',{cache:'no-store',signal:AbortSignal.timeout(10000)}),d=await r.json();if(!r.ok)throw Error(d.error);setData(d);}
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 async function makeTestInvites(){
 if(busy)return;setBusy(true);setError('');setNotice('');setTestInvites([]);
 const done=[];
 try{
  for(const t of TEST_CREW){
   const r=await fetch('/api/operacao/equipe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',email:t.email,role:t.role}),signal:AbortSignal.timeout(15000)});
   const result=await r.json();
   done.push({email:t.email,role:t.role,link:r.ok?result.link:null,error:r.ok?null:(result.error||'Falhou')});
   setTestInvites([...done]);
  }
  setNotice('Convites gerados. Copie cada link em particular; cada pessoa define senha própria de no mínimo 12 caracteres.');
  await load();
 }catch(e){setError('Geração interrompida: '+e.message+'. Confira os convites já gerados antes de repetir.');}
 finally{setBusy(false);}
}
async function run(body){if(busy)return;setBusy(true);setError('');setLink('');setNotice('');try{const r=await fetch('/api/operacao/equipe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)}),d=await r.json();if(!r.ok)throw Error(d.error);if(d.link)setLink(d.link);else setNotice('Permissões atualizadas.');await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <StaffShell title="Pessoas que fazem acontecer"><AccessRequests/><a href="/operacao/geral">← Voltar à gestão geral</a><p>Cadastre cada colaborador com seu próprio e-mail. Somente a gestão define funções e habilita acessos.</p><div className="card"><strong>Preparar cinco acessos de teste</strong><p>Portaria, Guia, Apoio, Coordenação e Caixa. Cada convite terá link pessoal; não utilize a senha compartilhada que já circulou nesta conversa.</p>
 <button type="button" disabled={busy} onClick={makeTestInvites}>{busy?'Gerando convites…':'Gerar cinco convites individuais'}</button>
 {testInvites.map(t=><div key={t.email} style={{marginTop:14}}><strong>{t.email}</strong><small>{t.role}</small>{t.link?<><textarea aria-label={'Convite '+t.email} readOnly value={t.link} onFocus={e=>e.target.select()}/><button type="button" disabled={busy} onClick={()=>navigator.clipboard.writeText(t.link).then(()=>setNotice('Link copiado para '+t.email)).catch(()=>setNotice('Selecione e copie o link.'))}>Copiar convite individual</button></>:<small style={{color:'#ffbfc3'}}>{t.error}</small>}</div>)}
 </div><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);run({action:'invite',email:f.get('email'),role:f.get('role')});}}><strong>Novo colaborador</strong><div className="pair"><label>E-mail<input name="email" type="email" required autoComplete="email"/></label><label>Função<select name="role" defaultValue="apoio">{Object.entries(ops.ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div><button disabled={busy}>Gerar convite individual</button><small>O convite não é enviado automaticamente. Entregue o link diretamente à pessoa, por um canal privado.</small></form>{error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}{link&&<div className="card"><strong>Convite pronto</strong><label>Link individual<textarea readOnly value={link} onFocus={e=>e.target.select()}/></label><button onClick={async()=>{try{await navigator.clipboard.writeText(link);setNotice('Link copiado.');}catch{setNotice('Selecione o link acima e copie.');}}}>Copiar link</button><small>Envie apenas ao destinatário. O link é de uso único e expira conforme a configuração do Supabase.</small></div>}{data?.staff.map(p=><Person key={p.user_id+':'+p.role+':'+p.active} person={p} self={p.user_id===data.self} run={run} busy={busy}/> )}</StaffShell>;
}
