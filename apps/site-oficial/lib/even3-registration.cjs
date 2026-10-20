// Only registration lifecycle events are projected here. Confirmation is NOT payment.
const statuses = new Map([
 ['Participante com inscrição pendente no evento', 'pending'],
 ['Participante com inscrição confirmada no evento', 'confirmed'],
 ['Participante com inscrição cancelada no evento', 'cancelled']
]);
function identifier(value) {
 const text=String(value??'');
 return /^[0-9]{1,20}$/.test(text) ? text : null;
}
function registrationFrom(body) {
 const status=statuses.get(body?.type?.name);
 const data=body?.data===undefined?body:body.data;
 // codigo is the individual ticket printed in the confirmation. id is not used as ticket identity.
 const registrationId=identifier(data?.inscricao?.codigo), participantId=identifier(data?.pessoa?.id);
 const name=typeof data?.pessoa?.nome==='string'?data.pessoa.nome.trim():'';
 if(!status||!registrationId||!participantId||!name||name.length>300)return null;
 return {registrationId,participantId,name,status};
}
async function saveNotification(client,event,body) {
 const inserted=await client.query(`INSERT INTO even3_integration.webhook_inbox
 (event_id,notification_id,trigger_name,occurred_at,payload_hash,payload)
 VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(event_id,notification_id) DO NOTHING RETURNING notification_id`,
 [event.eventId,event.notificationId,event.trigger,event.occurredAt,event.payloadHash,JSON.stringify(body)]);
 const duplicate=!inserted.rowCount;
 if(duplicate){
  const old=await client.query('SELECT payload_hash FROM even3_integration.webhook_inbox WHERE event_id=$1 AND notification_id=$2',[event.eventId,event.notificationId]);
  if(old.rows[0]?.payload_hash!==event.payloadHash)return {duplicate:true,conflict:true};
 }
 const current=registrationFrom(body);
 if(!current)return {duplicate,conflict:false,processing:'pending_review'};
 // Serialize deliveries of the same registration; do not let late confirmations undo cancellation.
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[event.eventId,current.registrationId]);
 const history=await client.query(`SELECT payload FROM even3_integration.webhook_inbox
 WHERE event_id=$1 AND (CASE WHEN payload ? 'data' THEN payload->'data'->'inscricao'->>'codigo' ELSE payload->'inscricao'->>'codigo' END)=$2 AND trigger_name=ANY($3::text[])
 ORDER BY occurred_at DESC, CASE WHEN trigger_name=$4 THEN 0 ELSE 1 END, notification_id DESC`,
 [event.eventId,current.registrationId,[...statuses.keys()],'Participante com inscrição cancelada no evento']);
 const latest=history.rows.map(row=>registrationFrom(row.payload)).find(Boolean);
 if(!latest)throw Error('Registration history missing');
 await client.query(`INSERT INTO peniel_ops.registrations
 (event_id,registration_id,participant_id,participant_name,registration_status)
 VALUES($1,$2,$3,$4,$5)
 ON CONFLICT(event_id,registration_id) DO UPDATE SET
 participant_id=EXCLUDED.participant_id,participant_name=EXCLUDED.participant_name,
 registration_status=EXCLUDED.registration_status,updated_at=now()`,
 [event.eventId,latest.registrationId,latest.participantId,latest.name,latest.status]);
 // payment_status remains unknown; activity/day and admission are never inferred.
 return {duplicate,conflict:false,processing:'registration_recorded_pending_verification'};
}
module.exports={registrationFrom,saveNotification};
