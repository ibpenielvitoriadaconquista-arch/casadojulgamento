import {throttle} from '../../../lib/staff-access';
import {authConfig,cookie,fail,sameOrigin} from '../../../lib/operation-auth';
import {query} from '../../../lib/db';
export const config={api:{bodyParser:{sizeLimit:'8kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(req.method!=='POST')throw fail(405,'Método não permitido.');
  sameOrigin(req);
  if(req.body?.logout){res.setHeader('Set-Cookie',cookie('',0));return res.json({ok:true});}
  const {email,password}=req.body||{};
  if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>512)throw fail(400,'Informe e-mail e senha.');
  await throttle(req,'login');
  const {url,key}=authConfig();
  const r=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw fail(r.status===429?429:401,'Não foi possível entrar. Confira os dados ou tente mais tarde.');
  const data=await r.json();
  const staff=await query('SELECT role FROM peniel_ops.staff WHERE user_id=$1 AND active=true',[data.user?.id]);
  if(!staff.rows[0])throw fail(403,'Conta ainda não habilitada pela administração.');
  res.setHeader('Set-Cookie',cookie(data.access_token,Math.min(data.expires_in||3600,3600)));
  return res.json({role:staff.rows[0].role});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Serviço indisponível. Tente novamente.'});}
}
