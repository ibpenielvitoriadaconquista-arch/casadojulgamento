import {useEffect,useState} from 'react';
import {sessionLock,isExiting,logoutOperation} from '../lib/session-client';
export default function SessionHeartbeat(){
 const [warning,setWarning]=useState(''),[needsLogin,setNeedsLogin]=useState(false);
 useEffect(()=>{
  let stopped=false,running=false;
  const keepAlive=async()=>{
   if(stopped||running||isExiting())return;running=true;
   try{await sessionLock(async()=>{
    if(stopped||isExiting())return;
    const r=await fetch('/api/operacao/sessao',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store',signal:AbortSignal.timeout(12000)});
    const data=await r.json();if(stopped||isExiting())return;
    if(r.ok){setNeedsLogin(!data.renewable);setWarning(data.renewable?'':'Entre novamente uma vez para ativar a renovação automática deste acesso.');window.dispatchEvent(new Event('peniel-session-ready'));}
    else{setNeedsLogin(r.status===401||r.status===403);setWarning(r.status===401||r.status===403?'Sua sessão foi encerrada. Entre novamente.':'Conexão instável. Tentando renovar automaticamente…');}
   });}catch{if(!stopped){setNeedsLogin(false);setWarning('Sem conexão para renovar a sessão. Tentando reconectar…');}}finally{running=false;}
  };
  const stop=()=>{stopped=true;};
  const otherLogout=e=>{if(e.key==='peniel.session.logout'){stop();setNeedsLogin(true);setWarning('A conta saiu em outra janela. Entre novamente.');}};
  const visible=()=>{if(document.visibilityState==='visible')keepAlive();};
  keepAlive();const interval=setInterval(keepAlive,60000);
  window.addEventListener('online',keepAlive);window.addEventListener('focus',keepAlive);document.addEventListener('visibilitychange',visible);window.addEventListener('peniel-session-logout',stop);window.addEventListener('storage',otherLogout);
  return()=>{stopped=true;clearInterval(interval);window.removeEventListener('online',keepAlive);window.removeEventListener('focus',keepAlive);document.removeEventListener('visibilitychange',visible);window.removeEventListener('peniel-session-logout',stop);window.removeEventListener('storage',otherLogout);};
 },[]);
 return warning?<div role="status" style={{padding:'12px 20px',background:'#fff2d6',color:'#694710',font:'14px/1.5 system-ui'}}>{warning} <>{needsLogin&&<button type="button" style={{color:'inherit',fontWeight:700,marginLeft:12,cursor:'pointer'}} onClick={logoutOperation}>Sair e entrar novamente</button>}</></div>:null;
}
