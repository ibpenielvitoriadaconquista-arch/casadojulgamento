'use strict';
const https=require('node:https');
const normalize=s=>String(s||'').normalize('NFC').trim().toLowerCase();
// The documented V1 details endpoint uses a GET request body (not a query parameter).
function details(reference,token=process.env.EVEN3_API_TOKEN){
 return new Promise((resolve,reject)=>{
  if(!token)return reject(Error('Even3 credential missing'));
  const body=JSON.stringify({reference});
  const req=https.request('https://www.even3.com.br/api/v1/payments/details',{method:'GET',headers:{'Authorization-Token':token,'Content-Type':'application/json',Accept:'application/json','Content-Length':Buffer.byteLength(body)}},res=>{
   let raw='';res.on('data',chunk=>{raw+=chunk;if(raw.length>1000000)req.destroy(Error('Response too large'));});res.on('error',reject);
   res.on('end',()=>{try{if(res.statusCode!==200)throw Error('Payment details unavailable');const x=JSON.parse(raw);if(!Array.isArray(x.data)||Number(x.count)!==x.data.length)throw Error('Incomplete payment details');resolve(x.data);}catch(e){reject(e);}});
  });req.setTimeout(8000,()=>req.destroy(Error('Payment details timeout')));req.on('error',reject);req.end(body);
 });
}
function matches(item,p,entry){
 if(String(item.id_event)!==String(p.id_event))return false;
 if(item.checkin_code!=null)return String(item.checkin_code)===String(p.checkin_code)&&String(item.item||'').normalize('NFC').trim()===entry.category;
 if(item.id_attendees!=null)return String(item.id_attendees)===String(p.id_attendees)&&String(item.item||'').normalize('NFC').trim()===entry.category;
 return !!normalize(p.email)&&normalize(item.email_attendee)===normalize(p.email)&&normalize(item.attendee)===normalize(p.name)&&String(item.item||'').normalize('NFC').trim()===entry.category;
}
async function reconcile({p,entry,query,even3}){
 const code=String(p.checkin_code),EVENT='798621';
 const prior=(await query('SELECT * FROM peniel_ops.entry_authorizations WHERE event_id=$1 AND ticket_code=$2',[EVENT,code])).rows[0];
 if(prior&&(prior.checked_in_at||prior.revoked_at||!prior.evidence_reference.startsWith('even3-payment:')))return;
 // Composite matches are accepted only when the imported identity/category is unique.
 const unique=await query('SELECT count(*)::int AS total FROM public.cdj_even3_api_attendees WHERE event_id=$1 AND lower(trim(participant_email))=$2 AND lower(trim(participant_name))=$3 AND category_name=$4',[EVENT,normalize(p.email),normalize(p.name),entry.category]);
 if(unique.rows[0]?.total!==1)return;
 try{
  const payments=await even3.request('payments'),rows=even3.items(payments);
  if(Number(payments.count)!==rows.length||rows.length>20)throw Error('Payment list requires dedicated reconciliation');
  const all=await Promise.all(rows.map(async pay=>({pay,items:await details(pay.reference_payment)})));
  const found=all.flatMap(({pay,items})=>items.filter(item=>String(item.id_payment)===String(pay.id_payment)&&String(item.reference_payment)===String(pay.reference_payment)&&matches(item,p,entry)).map(item=>({pay,item})));
  if(found.length!==1)throw Error('Individual financial link is ambiguous');
  const {pay,item}=found[0];
  if(String(pay.id_event)!==EVENT||pay.status_payment!=='Pago'||Number(item.amount)<=0){
   if(prior)await query("UPDATE peniel_ops.entry_authorizations SET revoked_at=now(),payment_status='pending',updated_at=now() WHERE event_id=$1 AND ticket_code=$2 AND checked_in_at IS NULL",[EVENT,code]);
   return;
  }
  const ref='even3-payment:'+String(pay.id_payment)+':'+String(pay.reference_payment);
  await query(`INSERT INTO peniel_ops.entry_authorizations(event_id,ticket_code,entry_id,participant_id,participant_name,registration_status,payment_status,evidence_reference,verified_at) VALUES($1,$2,$3,$4,$5,'confirmed','paid',$6,now()) ON CONFLICT(event_id,ticket_code) DO UPDATE SET verified_at=now(),updated_at=now(),evidence_reference=excluded.evidence_reference WHERE peniel_ops.entry_authorizations.revoked_at IS NULL AND peniel_ops.entry_authorizations.checked_in_at IS NULL AND peniel_ops.entry_authorizations.evidence_reference LIKE 'even3-payment:%'`,[EVENT,code,entry.entryId,String(p.id_attendees),p.name,ref]);
 }catch{
  if(prior)throw Object.assign(Error('Não foi possível atualizar a comprovação financeira na Even3. Procure a Gestão.'),{status:503});
 }
}
module.exports={details,matches,reconcile};
