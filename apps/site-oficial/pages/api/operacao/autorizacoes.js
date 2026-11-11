import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import {query,transaction} from '../../../lib/db';
import tickets from '../../../lib/entry-tickets.cjs';
import even3 from '../../../lib/even3-client.cjs';
import cashAuthorization from '../../../lib/cash-authorization.cjs';
import authorizations from '../../../lib/operator-authorizations.cjs';
const service=authorizations.createService({query,transaction,even3});
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 try{
  const user=await actor(req,res);if(!cashAuthorization.allowed(user.role,req.method,req.body))throw fail(403,'A Gestão confirma evidências; o Caixa pode confirmar apenas recebimentos em dinheiro ou Pix da igreja.');
  if(req.method==='GET'){
   const rows=await query(`SELECT p.checkin_code,p.participant_name,p.category_name,a.payment_status,a.evidence_reference,a.revoked_at,c.status AS checkin_status,c.requested_at,c.confirmed_at,c.admitted_at FROM public.cdj_even3_api_attendees p LEFT JOIN peniel_ops.entry_authorizations a ON a.event_id=p.event_id AND a.ticket_code=p.checkin_code LEFT JOIN peniel_ops.entry_checkins c ON c.event_id=p.event_id AND c.ticket_code=p.checkin_code WHERE p.event_id=$1 ORDER BY p.participant_name LIMIT 500`,[tickets.EVENT_ID]);
   return res.json({tickets:rows.rows});
  }
  if(req.method!=='POST')throw fail(405,'Método não permitido.');sameOrigin(req);
  return res.json(await service.execute(user,req.body||{}));
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível registrar a conferência.'});}
}
