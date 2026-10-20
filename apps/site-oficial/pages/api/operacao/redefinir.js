import {authClient} from '../../../lib/staff-access';
import {cookie,fail,sameOrigin} from '../../../lib/operation-auth';
export const config={api:{bodyParser:{sizeLimit:'6kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(req.method!=='POST')throw fail(405,'Método não permitido.');
  sameOrigin(req);
  const {accessToken,refreshToken,tokenHash,type,password}=req.body||{};
  if(typeof password!=='string'||password.length<12||password.length>128)throw fail(400,'Use uma senha de 12 caracteres ou mais.');
  const client=authClient();
  const result=(accessToken&&refreshToken)
   ?await client.auth.setSession({access_token:accessToken,refresh_token:refreshToken})
   :type==='recovery'&&typeof tokenHash==='string'
    ?await client.auth.verifyOtp({token_hash:tokenHash,type:'recovery'})
    :{error:new Error('Invalid token')};
  if(result.error||!result.data?.session?.user?.id)throw fail(401,'Link inválido ou expirado. Solicite outro.');
  const updated=await client.auth.updateUser({password});
  if(updated.error)throw fail(400,'Não foi possível definir essa senha.');
  res.setHeader('Set-Cookie',cookie('',0)); // Force login with new password; do not leave the reset session active.
  return res.json({ok:true});
 }catch(e){
  if(!e.status)console.error('peniel_password_reset_error',{kind:String(e?.name||'unknown').slice(0,40)});
  return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível redefinir agora.'});
 }
}
