import {authClient,throttle} from '../../../lib/staff-access';
import {sameOrigin,fail,cookie} from '../../../lib/operation-auth';
import {query} from '../../../lib/db';
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(req.method!=='POST')throw fail(405,'Método não permitido.');sameOrigin(req);await throttle(req,'activation');
  const {tokenHash,type,password,accessToken,refreshToken}=req.body||{};
  const client=authClient();let session;
  if(accessToken&&refreshToken){const result=await client.auth.setSession({access_token:accessToken,refresh_token:refreshToken});if(result.error)throw fail(401,'Sessão de ativação expirada. Peça um novo convite.');session=result.data.session;}
  else{
   if(typeof tokenHash!=='string'||tokenHash.length>512||!['invite','recovery'].includes(type))throw fail(400,'Abra o link de convite enviado pela coordenação.');
   const result=await client.auth.verifyOtp({token_hash:tokenHash,type});if(result.error)throw fail(401,'Convite inválido, utilizado ou expirado. Peça um novo link à coordenação.');session=result.data.session;
  }
  if(!session?.user?.id)throw fail(401,'Não foi possível validar o convite.');
  const staff=await query('SELECT role FROM peniel_ops.staff WHERE user_id=$1 AND active=true',[session.user.id]);if(!staff.rows[0])throw fail(403,'Acesso não habilitado pela gestão.');
  // Two-phase flow: retain tokens only in page memory, allowing a password retry without reusing the OTP.
  if(password===undefined)return res.json({accessToken:session.access_token,refreshToken:session.refresh_token,email:session.user.email});
  if(typeof password!=='string'||password.length<12||password.length>128)throw fail(400,'Use uma senha de 12 a 128 caracteres.');
  const result=await client.auth.updateUser({password});if(result.error)throw fail(400,'Não foi possível definir essa senha. Use uma senha diferente com pelo menos 12 caracteres.');
  res.setHeader('Set-Cookie',cookie(session.access_token,Math.min(session.expires_in||3600,3600)));return res.json({role:staff.rows[0].role});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Serviço indisponível. Tente novamente.'});}
}
