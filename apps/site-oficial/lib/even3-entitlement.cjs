'use strict';
// Organizer policy: current confirmed Even3 registration authorizes admission.
// Financial status remains pending here: this is NOT proof of money received.
const reference=(p,entry)=>'even3-confirmed-registration:798621:'+String(p.id_attendees)+':'+entry.entryId;
async function authorize({p,entry,query}){
 if(String(p?.id_event)!=='798621'||p.confirmed!==true||!p.id_attendees||!p.checkin_code||!entry?.entryId)throw Error('Inscrição Even3 não confirmada.');
 await query(`INSERT INTO peniel_ops.entry_authorizations(event_id,ticket_code,entry_id,participant_id,participant_name,registration_status,payment_status,evidence_reference,verified_at) VALUES($1,$2,$3,$4,$5,'confirmed','pending',$6,now()) ON CONFLICT(event_id,ticket_code) DO NOTHING`,['798621',String(p.checkin_code),entry.entryId,String(p.id_attendees),p.name,reference(p,entry)]);
}
function confirmedBasis(a,p,entry){return a?.payment_status==='pending'&&a.evidence_reference===reference(p,entry);}
module.exports={authorize,confirmedBasis,reference};
