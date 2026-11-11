'use strict';
const REFRESH_SECONDS=24*60*60;
function accessCookie(token,seconds,secure=process.env.NODE_ENV==='production'){return `peniel_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${seconds}${secure?'; Secure':''}`;}
function refreshCookie(token,seconds=REFRESH_SECONDS,secure=process.env.NODE_ENV==='production'){return `peniel_refresh=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${seconds}${secure?'; Secure':''}`;}
function sessionCookies(session){
 if(!session?.access_token||!session.refresh_token)throw Object.assign(Error('Não foi possível preparar a sessão renovável.'),{status:503});
 return [accessCookie(session.access_token,Math.max(1,Math.min(Number(session.expires_in)||3600,3600))),refreshCookie(session.refresh_token)];
}
function clearCookies(){return [accessCookie('',0),refreshCookie('',0)];}
// An unverified expiry is only a refresh hint, never authentication/authorization.
function needsRefresh(token,now=Date.now()){
 try{const payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());return !Number.isFinite(payload.exp)||payload.exp*1000<=now+5*60*1000;}catch{return true;}
}
async function renew({req,res,config,query,fetcher=fetch}){
 const refresh=req.cookies?.peniel_refresh;
 if(!refresh)throw Object.assign(Error('Entre novamente para ativar a renovação da sessão.'),{status:401});
 const response=await fetcher(config.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refresh}),signal:AbortSignal.timeout(10000)});
 if(!response.ok){
  // Network/server/rate failures never discard a still recoverable refresh token.
  if([400,401,403].includes(response.status)){res.setHeader('Set-Cookie',clearCookies());throw Object.assign(Error('Sessão encerrada. Entre novamente.'),{status:401});}
  throw Object.assign(Error('Não foi possível renovar agora. A conexão será tentada novamente.'),{status:503});
 }
 const data=await response.json();
 if(!data.user?.id||!data.access_token||!data.refresh_token)throw Object.assign(Error('Resposta de autenticação incompleta.'),{status:503});
 const staff=await query('SELECT user_id, role FROM peniel_ops.staff WHERE user_id=$1 AND active=true',[data.user.id]);
 if(!staff.rows[0]||staff.rows[0].role==='guias'){res.setHeader('Set-Cookie',clearCookies());throw Object.assign(Error('Acesso não habilitado pela Gestão.'),{status:403});}
 res.setHeader('Set-Cookie',sessionCookies(data));req.cookies={...req.cookies,peniel_session:data.access_token,peniel_refresh:data.refresh_token};
 return staff.rows[0];
}
module.exports={sessionCookies,clearCookies,needsRefresh,renew,REFRESH_SECONDS};
