import {authClient,throttle} from '../../../lib/staff-access';
import {fail,sameOrigin} from '../../../lib/operation-auth';
export const config={api:{bodyParser:{sizeLimit:'3kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(req.method!=='POST')throw fail(405,'Método não permitido.');
  sameOrigin(req);
  const email=String(req.body?.email||'').trim().toLowerCase();
  if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail(400,'Informe seu e-mail.');
  await throttle(req,'password_reset');
  const {error}=await authClient().auth.resetPasswordForEmail(email,{
   redirectTo:'https://www.ibpeniel.com/operacao/redefinir'
  });
  if(error){
   const rateLimited=error.status===429||/rate limit|too many/i.test(String(error.message||''));
   if(rateLimited)return res.status(429).json({error:'Limite temporário de envio de e-mails do Supabase atingido. Aguarde antes de solicitar outro link ou peça ajuda à Gestão Geral.'});
   console.error('peniel_password_request_error',{kind:String(error.name||'unknown').slice(0,40),status:Number(error.status)||0});
   return res.status(503).json({error:'Não foi possível enviar o e-mail agora. Tente novamente mais tarde.'});
  }
  return res.json({ok:true,message:'Se a conta existir, você receberá instruções de recuperação no e-mail.'});
 }catch(e){
  if(!e.status)console.error('peniel_password_request_error',{kind:String(e?.code||e?.name||'unknown').slice(0,40)});
  return res.status(e.status||503).json({error:e.status?e.message:'Recuperação indisponível temporariamente.'});
 }
}
