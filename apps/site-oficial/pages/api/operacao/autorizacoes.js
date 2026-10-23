import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import {query,transaction} from '../../../lib/db';
import tickets from '../../../lib/entry-tickets.cjs';
import rules from '../../../lib/official-entries.cjs';
import even3 from '../../../lib/even3-client.cjs';
import cashAuthorization from '../../../lib/cash-authorization.cjs';
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 try{
  const user=await actor(req);if(!cashAuthorization.allowed(user.role,req.method,req.body))throw fail(403,'A Gestão confirma evidências; o Caixa pode confirmar apenas recebimentos em dinheiro ou Pix da igreja.');
  if(req.method==='GET'){
   const rows=await query(`SELECT p.checkin_code,p.participant_name,p.category_name,a.payment_status,a.evidence_reference,a.revoked_at,c.status AS checkin_status,c.requested_at,c.confirmed_at,c.admitted_at FROM public.cdj_even3_api_attendees p LEFT JOIN peniel_ops.entry_authorizations a ON a.event_id=p.event_id AND a.ticket_code=p.checkin_code LEFT JOIN peniel_ops.entry_checkins c ON c.event_id=p.event_id AND c.ticket_code=p.checkin_code WHERE p.event_id=$1 ORDER BY p.participant_name LIMIT 500`,[tickets.EVENT_ID]);
   return res.json({tickets:rows.rows});
  }
  if(req.method!=='POST')throw fail(405,'Método não permitido.');sameOrigin(req);
  const {code:raw,action,evidence:input,paymentStatus}=req.body||{},code=tickets.parseTicketCode(raw),inputEvidence=String(input||'').trim();
  const evidence=user.role==='caixa'?`Caixa / ${req.body.paymentMethod}: ${inputEvidence}`:inputEvidence;
  if(!code||inputEvidence.length<10||evidence.length>500||!['authorize','revoke','confirm_external','retry_external'].includes(action))throw fail(400,'Informe o QR, a ação e a referência verificável da conferência (10–500 caracteres).');
  let p,entry;
  if(action==='authorize'){
   if(!['paid','exempt'].includes(paymentStatus))throw fail(400,'Informe pagamento ou cortesia comprovada.');
   const cached=(await query('SELECT attendee_id FROM public.cdj_even3_api_attendees WHERE event_id=$1 AND checkin_code=$2',[tickets.EVENT_ID,code])).rows;
   if(cached.length!==1)throw fail(409,'QR não localizado de forma única.');
   p=await even3.attendee(cached[0].attendee_id);entry=rules.byCategory(p.registration_category);
   if(!entry||p.confirmed!==true||String(p.checkin_code)!==code||String(p.id_event)!==tickets.EVENT_ID)throw fail(409,'Inscrição não confirmada ou categoria inválida.');
   if(!rules.catalogMatches(await even3.event(),entry))throw fail(409,'Categoria divergente do catálogo.');
  }
  await transaction(async db=>{
   const authorization=(await db.query('SELECT * FROM peniel_ops.entry_authorizations WHERE event_id=$1 AND ticket_code=$2 FOR UPDATE',[tickets.EVENT_ID,code])).rows[0];
   if(user.role==='caixa'&&authorization?.revoked_at)throw fail(409,'Autorização revogada. A Gestão deve revisar antes de receber nova confirmação.');
   const attempt=(await db.query('SELECT * FROM peniel_ops.entry_checkins WHERE event_id=$1 AND ticket_code=$2 FOR UPDATE',[tickets.EVENT_ID,code])).rows[0];
   if(action==='authorize'){
    if(attempt)throw fail(409,'Ingresso já possui credenciamento em processamento ou concluído.');
    await db.query(`INSERT INTO peniel_ops.entry_authorizations(event_id,ticket_code,entry_id,participant_id,participant_name,registration_status,payment_status,evidence_reference,verified_at) VALUES($1,$2,$3,$4,$5,'confirmed',$6,$7,now()) ON CONFLICT(event_id,ticket_code) DO UPDATE SET entry_id=excluded.entry_id,participant_id=excluded.participant_id,participant_name=excluded.participant_name,registration_status='confirmed',payment_status=excluded.payment_status,evidence_reference=excluded.evidence_reference,verified_at=now(),revoked_at=null,updated_at=now() WHERE peniel_ops.entry_authorizations.checked_in_at IS NULL`,[tickets.EVENT_ID,code,entry.entryId,String(p.id_attendees),p.name,paymentStatus,evidence]);
   }else if(action==='revoke'){
    if(attempt?.status==='admitted')throw fail(409,'Entrada já utilizada; preserve o histórico e procure a coordenação.');
    await db.query("UPDATE peniel_ops.entry_authorizations SET revoked_at=now(),registration_status='cancelled',updated_at=now() WHERE event_id=$1 AND ticket_code=$2",[tickets.EVENT_ID,code]);
   }else{
    if(!attempt||!['sending','uncertain','rejected'].includes(attempt.status)||Date.now()-new Date(attempt.requested_at).getTime()<60000)throw fail(409,'Conferência permitida somente para tentativa pendente há mais de um minuto.');
    if(action==='confirm_external')await db.query("UPDATE peniel_ops.entry_checkins SET status='confirmed',confirmed_at=now(),response_code='operator_verified',resolved_by=$3,resolution_evidence=$4,updated_at=now() WHERE event_id=$1 AND ticket_code=$2",[tickets.EVENT_ID,code,user.user_id,evidence]);
    else {
     // Audit preserves the old attempt before allowing a new send. Only after organizer verified absence externally.
     await db.query('DELETE FROM peniel_ops.entry_checkins WHERE event_id=$1 AND ticket_code=$2',[tickets.EVENT_ID,code]);
    }
   }
   await db.query('INSERT INTO peniel_ops.entry_financial_audit(event_id,ticket_code,actor_id,action,evidence) VALUES($1,$2,$3,$4,$5)',[tickets.EVENT_ID,code,user.user_id,action,JSON.stringify({reference:evidence,previousAttempt:attempt?{status:attempt.status,requestedAt:attempt.requested_at,response:attempt.response_code}:null})]);
  });
  return res.json({ok:true,message:action==='confirm_external'?'Confirmação externa registrada. A Portaria pode concluir a entrada sem reenviar.':'Conferência registrada com auditoria.'});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível registrar a conferência.'});}
}
