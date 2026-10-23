import {useState,useRef,useEffect} from 'react';
import tickets from '../lib/official-entries.cjs';

// No browser-side validation grants admission. The server is authoritative.
export default function GateTicketScanner({session,rehearsal=false,testLot=false}){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState(null),[error,setError]=useState('');
 const [camera,setCamera]=useState(false),[cameraError,setCameraError]=useState('');
 const video=useRef(null),stream=useRef(null),detector=useRef(null),reading=useRef(false),active=useRef(false),canvas=useRef(null),decoder=useRef(null);
 const [selectedCode,setSelectedCode]=useState('');
 const sessionData=tickets.ENTRIES.find(e=>e.session===session);
 useEffect(()=>{setResult(null);setCode('');setError('');},[session]);
 useEffect(()=>()=>{stream.current?.getTracks().forEach(t=>t.stop());},[]);
 function stopCamera(){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;active.current=false;setCamera(false);}
 async function send(ticket,action='lookup'){
  if(reading.current)return;reading.current=true;setBusy(true);setError('');
  if(action==='lookup')setResult(null);
  try{
   const r=await fetch(rehearsal?'/api/operacao/ingresso-ensaio':'/api/operacao/ingresso',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code:ticket,session,action}),signal:AbortSignal.timeout(45000)});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Não foi possível validar o ingresso.');
   setSelectedCode(ticket);setResult(data);
  }catch(e){setError(e.name==='TimeoutError'?'Conexão demorou. Não libere a entrada.':e.message||'Falha na consulta.');}
  finally{reading.current=false;setBusy(false);}
 }
 async function ensureDecoder(){
  if(window.jsQR){decoder.current=window.jsQR;return true;}
  await new Promise((resolve,reject)=>{
   const prior=document.querySelector('script[data-cdj-jsqr]');
   if(prior){if(window.jsQR)return resolve();prior.addEventListener('load',resolve,{once:true});prior.addEventListener('error',reject,{once:true});return;}
   const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';script.async=true;script.dataset.cdjJsqr='true';
   script.onload=resolve;script.onerror=()=>reject(new Error('Leitor alternativo indisponível.'));document.head.appendChild(script);
  });
  decoder.current=window.jsQR;
  return typeof decoder.current==='function';
 }
 async function startCamera(){
  setCameraError('');
  if(!navigator.mediaDevices?.getUserMedia){setCameraError('Este navegador não permite abrir a câmera. Use Chrome atualizado, permita a câmera ou digite o código.');return;}
  try{
   let nativeSupported=false;
   if(window.BarcodeDetector){
    try{const formats=await window.BarcodeDetector.getSupportedFormats();nativeSupported=formats.includes('qr_code');}catch{nativeSupported=true;}
   }
   if(nativeSupported){try{detector.current=new window.BarcodeDetector({formats:['qr_code']});}catch{detector.current=null;}}
   // Request camera permission directly from the user's click before any network request.
   const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   stream.current=media;active.current=true;setCamera(true);
   if(!detector.current&&!await ensureDecoder())setCameraError('O leitor alternativo não carregou. Utilize o código manual.');
  }catch(e){stopCamera();setCameraError(e?.name==='NotAllowedError'?'O navegador recusou a câmera. Feche outras abas que usam a câmera e confirme a permissão deste site.':e?.message||'Não foi possível acessar a câmera. Digite o código individual.');}
 }
 useEffect(()=>{
  if(!camera)return;
  if(video.current&&stream.current){video.current.srcObject=stream.current;video.current.play().catch(()=>{});}
  let detecting=false;
  const timer=setInterval(async()=>{
   const el=video.current;
   if(!active.current||detecting||reading.current||!el||el.readyState<2)return;
   detecting=true;
   try{
    let value=null;
    if(detector.current){const codes=await detector.current.detect(el);value=codes?.[0]?.rawValue||null;}
    else if(decoder.current){
      const w=el.videoWidth,h=el.videoHeight;
      if(w&&h){const c=canvas.current||(canvas.current=document.createElement('canvas'));c.width=Math.min(w,960);c.height=Math.round(h*c.width/w);const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(el,0,0,c.width,c.height);const pixels=ctx.getImageData(0,0,c.width,c.height);value=decoder.current(pixels.data,c.width,c.height,{inversionAttempts:'attemptBoth'})?.data||null;}
    }
    if(value){stopCamera();setCode(value);await send(value,rehearsal?'lookup':'admit');}
   }catch{/* A failed frame must never admit someone. */}
   finally{detecting=false;}
  },500);
  return()=>clearInterval(timer);
 },[camera,session]);
 const canAdmit=result?.eligible&&result?.entry?.date===session&&!result?.checkedIn;
 return <section className="scanner" aria-label="Leitor de ingressos da portaria">
  <div className="head"><strong>Leitura do ingresso Even3</strong><span>{rehearsal?'CONSULTA':'CREDENCIAMENTO OFICIAL'}</span></div>
  {rehearsal&&<p role="status" className="warning"><b>{testLot?'INGRESSO GERAL - 1º LOTE · ENSAIO 22–23/10. Entrada somente na fila de treinamento.':'ENSAIO — sem pagamento validado e sem credenciamento real.'}</b></p>}
  <p>A leitura pela câmera credencia o ingresso válido na Even3 e registra a entrada. Para conferir antes, digite o código abaixo. Entrada selecionada: <b>{sessionData?.label||session}</b>.</p>
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
    onClick={()=>{if(window.confirm(rehearsal?'Confirmar chegada APENAS NO ENSAIO? Não registra entrada real.':'Confirma a entrada física deste participante?'))send(selectedCode,'admit');}}>
    {rehearsal?(testLot?'Liberar entrada no ensaio e enviar à Coordenação':'Enviar à Coordenação (SOMENTE ENSAIO)'):'Credenciar na Even3 e liberar entrada'}
   </button>}
  </div>}
  <p className="foot">A Portaria não pode liberar pessoas sem confirmação de inscrição, pagamento, data e uso anterior. Divergências vão para Gestão Geral.</p>
  <style jsx>{'.scanner{border:1px solid #66545b;background:#201a21;border-radius:15px;padding:20px;margin:18px 0 24px;color:#f7f0f3}.scanner *{box-sizing:border-box}.head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.head strong{font-size:17px}.head span{font-size:10px;border:1px solid #a88669;border-radius:18px;padding:6px;color:#e6c69d}p{font-size:13px;line-height:1.65;color:#d5c9cc}button{cursor:pointer}.entry{display:flex;gap:8px}.entry input{min-width:0;flex:1;padding:12px;border-radius:9px;border:1px solid #69595f;background:#110e13;color:#fff;font-size:16px}.entry button,.camera-button,.confirm{background:#b13c46;color:#fff;border:1px solid #d25a65;border-radius:9px;padding:12px 16px;font-size:14px;font-weight:700}.camera-button{margin:10px 0 14px}.entry button:disabled,button:disabled{opacity:.6}label{display:block;font-size:13px;font-weight:700;margin:8px 0}.result{background:#130f15;border:1px solid #5b4b53;border-radius:10px;padding:15px;margin-top:15px}.result strong{font-size:17px}.warning{color:#ffd3a5}.success{color:#b2ebc3}.confirm{background:#2f704f;border-color:#529a72}.foot{font-size:11px;color:#bdb0b5}.camera video{width:100%;max-height:300px;object-fit:cover;background:#000;border-radius:8px}.camera button{padding:8px;margin:8px 0;background:transparent;color:white;border:1px solid #aa969c;border-radius:9px}@media(max-width:480px){.scanner{padding:14px}.entry{flex-direction:column}.entry button{width:100%}}'}</style>
 </section>;
}
