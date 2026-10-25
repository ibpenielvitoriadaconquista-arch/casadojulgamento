import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import {query} from '../../../lib/db';
import mail from '../../../lib/staff-email.cjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 try{
  if(!['GET','POST'].includes(req.method))throw fail(405,'Método não permitido.');
  if(req.method==='POST')sameOrigin(req);
  const user=await actor(req);if(user.role!=='geral')throw fail(403,'Somente Gestão Geral pode conferir os envios.');
  if(req.method==='GET'){
   const r=await query('SELECT id,recipient,full_name,status,attempts,created_at,last_attempt_at FROM peniel_ops.staff_email_outbox ORDER BY created_at DESC LIMIT 100');
   return res.json({configured:mail.configured(),emails:r.rows});
  }
  const id=String(req.body?.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))throw fail(400,'Envio inválido.');
  if(!mail.configured())throw fail(503,'O remetente de confirmação ainda precisa ser configurado. O cadastro está salvo.');
  const result=await mail.createService({query}).dispatch(id);
  return res.json({ok:true,status:result.status,message:result.status==='accepted'?'Envio aceito pelo provedor. A entrega ainda precisa ser conferida pelo destinatário.':result.status==='unchanged'?'Nenhum novo envio realizado. Confira o estado e, se houver resposta incerta antiga, verifique o provedor antes de reenviar.':'Envio não confirmado. O cadastro continua salvo.'});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível conferir o envio agora.'});}
}
