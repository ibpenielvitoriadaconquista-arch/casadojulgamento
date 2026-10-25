import {query,transaction} from '../../../lib/db';
import {fail,sameOrigin} from '../../../lib/operation-auth';
import {throttle} from '../../../lib/staff-access';
import requests from '../../../lib/staff-requests.cjs';
import mail from '../../../lib/staff-email.cjs';
import templates from '../../../lib/staff-mail-templates.cjs';
export const config={api:{bodyParser:{sizeLimit:'3kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(req.method!=='POST')throw fail(405,'Método não permitido.');
  sameOrigin(req);
  let form;
  try{form=requests.cleanInput(req.body);}catch(e){throw fail(400,e.message);}
  await throttle(req,'staff_application');
  const emailId=await transaction(async client=>{
   const saved=await client.query(`INSERT INTO peniel_ops.access_requests(full_name,email,whatsapp,requested_role)
    VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET
      full_name=EXCLUDED.full_name,whatsapp=EXCLUDED.whatsapp,
      requested_role=EXCLUDED.requested_role,status='pending',
      reviewed_at=NULL,reviewed_by=NULL
    WHERE peniel_ops.access_requests.status='rejected' RETURNING id`,
    [form.name,form.email,form.whatsapp,form.role]);
   if(!saved.rows[0])return null;
   const queued=await client.query('INSERT INTO peniel_ops.staff_email_outbox(request_id,recipient,full_name,requested_role,message) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING id',
    [saved.rows[0].id,form.email,form.name,form.role,JSON.stringify(templates.application(form))]);
   return queued.rows[0].id;
  });
  if(emailId)try{await mail.createService({query}).dispatch(emailId);}catch{console.error('staff_confirmation_email_pending');}
  // Generic response; do not reveal whether an e-mail already exists.
  return res.status(202).json({ok:true,message:'Solicitação recebida. A gestão geral fará a análise.'});
 }catch(e){
  const status=e.status||503;
  if(status===503)console.error('peniel_access_request_error',{kind:String(e?.code||e?.name||'unknown').slice(0,40)});
  return res.status(status).json({error:e.status?e.message:'Não foi possível registrar agora. Tente novamente.'});
 }
}
