import {query} from '../../../lib/db';
import {fail,sameOrigin} from '../../../lib/operation-auth';
import {throttle} from '../../../lib/staff-access';
import requests from '../../../lib/staff-requests.cjs';
export const config={api:{bodyParser:{sizeLimit:'3kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(req.method!=='POST')throw fail(405,'Método não permitido.');
  sameOrigin(req);
  let form;
  try{form=requests.cleanInput(req.body);}catch(e){throw fail(400,e.message);}
  await throttle(req,'staff_application');
  await query(`INSERT INTO peniel_ops.access_requests(full_name,email,whatsapp,requested_role)
    VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET
      full_name=EXCLUDED.full_name,whatsapp=EXCLUDED.whatsapp,
      requested_role=EXCLUDED.requested_role,status='pending',
      reviewed_at=NULL,reviewed_by=NULL
    WHERE peniel_ops.access_requests.status='rejected'`,
    [form.name,form.email,form.whatsapp,form.role]);
  // Generic response; do not reveal whether an e-mail already exists.
  return res.status(202).json({ok:true,message:'Solicitação recebida. A gestão geral fará a análise.'});
 }catch(e){
  const status=e.status||503;
  if(status===503)console.error('peniel_access_request_error',{kind:String(e?.code||e?.name||'unknown').slice(0,40)});
  return res.status(status).json({error:e.status?e.message:'Não foi possível registrar agora. Tente novamente.'});
 }
}
