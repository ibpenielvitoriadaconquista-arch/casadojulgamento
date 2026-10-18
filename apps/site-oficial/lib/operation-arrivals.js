import {transaction} from './db';
import live from './operation-live.cjs';
// Internal function: the Even3 adapter must reconcile current statuses before calling.
// Deliberately not exposed as a public/manual arrival endpoint.
export async function acceptActivityCheckin({eventId,registrationId,activityId,occurredAt}){
 const date=new Date(occurredAt);
 if(!Number.isFinite(date.getTime()))throw Error('Horário de check-in inválido.');
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
 return transaction(async client=>{
  const mapping=await client.query('SELECT session_date::text FROM even3_integration.activity_map WHERE event_id=$1 AND activity_id=$2',[String(eventId),String(activityId)]);
  const session=mapping.rows[0]?.session_date;
  if(!session||session!==day)throw Error('Atividade sem mapeamento ou check-in fora do dia. Revisão necessária.');
  const row=await client.query('SELECT state,revision FROM peniel_ops.session_state WHERE session_date=$1 FOR UPDATE',[session]);
  if(!row.rows[0])throw Error('Sessão não preparada.');
  const records=await client.query('SELECT * FROM peniel_ops.registrations WHERE event_id=$1 AND registration_id=$2 FOR UPDATE',[String(eventId),String(registrationId)]);
  const p=records.rows[0];
  if(!p||p.activity_id!==String(activityId)||p.registration_status!=='confirmed'||p.activity_status!=='confirmed'||!['paid','exempt'].includes(p.payment_status))throw Error('Inscrição, pagamento ou atividade pendente de validação.');
  const state={schema:5,revision:Number(row.rows[0].revision),sessions:{[session]:row.rows[0].state}};
  const result=live.admit(state,session,{verified:true,participantId:p.participant_id,registrationId:p.registration_id,activityId:p.activity_id,name:p.participant_name},date.toISOString());
  if(!result.duplicate){
   await client.query('UPDATE peniel_ops.session_state SET state=$2::jsonb,revision=$3,updated_at=now() WHERE session_date=$1',[session,JSON.stringify(result.db.sessions[session]),result.db.revision]);
   await client.query('UPDATE peniel_ops.registrations SET checked_in_at=$3,updated_at=now() WHERE event_id=$1 AND registration_id=$2',[String(eventId),String(registrationId),date.toISOString()]);
  }
  return {duplicate:result.duplicate,session};
 });
}
