import {useState,useRef,useEffect} from 'react';
import tickets from '../lib/entry-tickets.cjs';

// No browser-side validation grants admission. The server is authoritative.
export default function GateTicketScanner({session}){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState(null),[error,setError]=useState('');
 const [camera,setCamera]=useState(false),[cameraError,setCameraError]=useState('');
 const video=useRef(null),stream=useRef(null),detector=useRef(null),reading=useRef(false),active=useRef(false);
 const [selectedCode,setSelectedCode]=useState('');
 const sessionData=tickets.ENTRIES.find(e=>e.session===session);
 useEffect(()=>{setResult(null);setCode('');setError('');},[session]);
 useEffect(()=>()=>{stream.current?.getTracks().forEach(t=>t.stop());},[]);
 function stopCamera(){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;active.current=false;setCamera(false);}
 async function send(ticket,action='lookup'){
  if(reading.current)return;reading.current=true;setBusy(true);setError('');
  if(action==='lookup')setResult(null);
  try{
   const r=await fetch('/api/operacao/ingresso',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code:ticket,session,action}),signal:AbortSignal.timeout(12000)});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Não foi possível validar o ingresso.');
   setSelectedCode(ticket);setResult(data);
  }catch(e){setError(e.name==='TimeoutError'?'Conexão demorou. Não libere a entrada.':e.message||'Falha na consulta.');}
  finally{reading.current=false;setBusy(false);}
 }
 async function startCamera(){
  setCameraError('');
  if(!navigator.mediaDevices?.getUserMedia||!window.BarcodeDetector){setCameraError('Câmera QR indisponível neste navegador. Digite o código abaixo.');return;}
  try{
   detector.current=new window.BarcodeDetector({formats:['qr_code']});
   const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   stream.current=s;active.current=true;setCamera(true);
  }catch{setCameraError('Não foi possível acessar a câmera. Verifique as permissões ou digite o código.');stopCamera();}
 }
 useEffect(()=>{
  if(!camera)return;
  if(video.current&&stream.current){video.current.srcObject=stream.current;video.current.play().catch(()=>{});}
  let detecting=false;
  const timer=setInterval(async()=>{
   if(!active.current||detecting||reading.current||!video.current||video.current.readyState<2)return;
   detecting=true;
   try{
    const qrs=await detector.current.detect(video.current);
    if(qrs?.[0]?.rawValue){const value=qrs[0].rawValue;stopCamera();setCode(value);await send(value);}
   }catch{/* transient video frames are not admission decisions */}
   finally{detecting=false;}
  },600);
  return()=>clearInterval(timer);
 },[camera,session]);
 const canAdmit=result?.eligible&&result?.entry?.date===session&&!result?.checkedIn;
 return <section className="scanner" aria-label="Leitor de ingressos da portaria">
  <div className="head"><strong>Leitura do ingresso Even3</strong><span>CONSULTA SEGURA</span></div>
  <p>Confira o QR ou digite o código individual do ingresso. Data selecionada: <b>{sessionData?.label||session}</b>.</p>
  {camera&&<div className="camera"><video ref={video} muted playsInline autoPlay aria-label="Câmera de leitura QR"/><button type="button" onClick={stopCamera}>Fechar câmera</button></div>}
  <button type="button" className="camera-button" disabled={busy} onClick={camera?stopCamera:startCamera}>{camera?'Desligar câmera':'Ler QR com câmera'}</button>
  {cameraError&&<p role="status" className="warning">{cameraError}</p>}
  <form onSubmit={e=>{e.preventDefault();send(code.trim());}}>
   <label htmlFor="ticket-input">Ou digite o código individual</label>
   <div className="entry"><input id="ticket-input" name="ticket" value={code} onChange={e=>{setCode(e.target.value);setResult(null);}}
     autoComplete="off" placeholder="Código do ingresso" maxLength={512} disabled={busy} required/>
    <button type="submit" disabled={busy||!code.trim()}>{busy?'Consultando…':'Consultar'}</button></div>
  </form>
  {error&&<p role="alert" className="warning">{error}</p>}
  {result&&<div className="result" role="status">
   <strong>{result.found?result.participantName||'Inscrição localizada':'Ingresso não encontrado'}</strong>
   {result.entry&&<p>Entrada: {result.entry.label}</p>}
   <p className={result.admitted?'success':'warning'}>{result.message}</p>
   {result.checkedIn&&<p>Já consta uma chegada para este código.</p>}
   {canAdmit&&<button className="confirm" type="button" disabled={busy}
    onClick={()=>{if(window.confirm('Confirma a entrada física deste participante?'))send(selectedCode,'admit');}}>
    Confirmar entrada e enviar à Coordenação
   </button>}
  </div>}
  <p className="foot">A Portaria não pode liberar pessoas sem confirmação de inscrição, pagamento, data e uso anterior. Divergências vão para Gestão Geral.</p>
  <style jsx>{'.scanner{border:1px solid #66545b;background:#201a21;border-radius:15px;padding:20px;margin:18px 0 24px;color:#f7f0f3}.scanner *{box-sizing:border-box}.head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.head strong{font-size:17px}.head span{font-size:10px;border:1px solid #a88669;border-radius:18px;padding:6px;color:#e6c69d}p{font-size:13px;line-height:1.65;color:#d5c9cc}button{cursor:pointer}.entry{display:flex;gap:8px}.entry input{min-width:0;flex:1;padding:12px;border-radius:9px;border:1px solid #69595f;background:#110e13;color:#fff;font-size:16px}.entry button,.camera-button,.confirm{background:#b13c46;color:#fff;border:1px solid #d25a65;border-radius:9px;padding:12px 16px;font-size:14px;font-weight:700}.camera-button{margin:10px 0 14px}.entry button:disabled,button:disabled{opacity:.6}label{display:block;font-size:13px;font-weight:700;margin:8px 0}.result{background:#130f15;border:1px solid #5b4b53;border-radius:10px;padding:15px;margin-top:15px}.result strong{font-size:17px}.warning{color:#ffd3a5}.success{color:#b2ebc3}.confirm{background:#2f704f;border-color:#529a72}.foot{font-size:11px;color:#bdb0b5}.camera video{width:100%;max-height:300px;object-fit:cover;background:#000;border-radius:8px}.camera button{padding:8px;margin:8px 0;background:transparent;color:white;border:1px solid #aa969c;border-radius:9px}@media(max-width:480px){.scanner{padding:14px}.entry{flex-direction:column}.entry button{width:100%}}'}</style>
 </section>;
}
