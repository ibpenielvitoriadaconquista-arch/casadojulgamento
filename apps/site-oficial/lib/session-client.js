let exiting=false;
export function sessionLock(task){return typeof navigator!=='undefined'&&navigator.locks?navigator.locks.request('peniel.session.refresh',task):task();}
export function isExiting(){return exiting;}
export async function logoutOperation(){
 exiting=true;
 try{localStorage.setItem('peniel.session.logout',String(Date.now()));}catch{}
 window.dispatchEvent(new Event('peniel-session-logout'));
 try{await sessionLock(()=>fetch('/api/operacao/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({logout:true}),signal:AbortSignal.timeout(15000)}));}
 finally{window.location.replace('/operacao/login');}
}
