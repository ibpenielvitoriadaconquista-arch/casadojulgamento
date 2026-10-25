'use strict';
const configured=(env=process.env)=>Boolean(env.RESEND_API_KEY&&env.STAFF_MAIL_FROM&&!/[\r\n]/.test(env.STAFF_MAIL_FROM));
function createService({query,fetcher=fetch,env=process.env}){
 async function dispatch(id){
  if(!configured(env))return {status:'pending',reason:'sender_not_configured'};
  // Retry only inside the provider's 24h idempotency window. A stale uncertain
  // request is retained for manual review rather than sent again blindly.
  const claim=await query(`UPDATE peniel_ops.staff_email_outbox SET status='sending',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),last_attempt_at=now(),sender=coalesce(sender,$2)
   WHERE id=$1 AND attempts<5 AND (first_attempt_at IS NULL OR first_attempt_at>now()-interval '23 hours')
   AND (status IN ('pending','failed') OR (status='sending' AND last_attempt_at<now()-interval '2 minutes')) RETURNING *`,[id,env.STAFF_MAIL_FROM]);
  const row=claim.rows[0];if(!row)return {status:'unchanged'};
  try{
   const message=row.message;
   const r=await fetcher('https://api.resend.com/emails',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'cdj-application/'+row.id},body:JSON.stringify({from:row.sender,to:[row.recipient],...message}),signal:AbortSignal.timeout(8000)});
   if(!r.ok)throw Object.assign(Error('Email provider refused request'),{safeCode:'HTTP_'+r.status});
   const body=await r.json();if(typeof body.id!=='string'||body.id.length>100)throw Error('Invalid provider response');
   await query("UPDATE peniel_ops.staff_email_outbox SET status='accepted',provider_message_id=$2,last_error=NULL WHERE id=$1",[id,body.id]);
   return {status:'accepted'};
  }catch(e){
   const code=/^HTTP_\d{3}$/.test(e.safeCode||'')?e.safeCode:'UNCONFIRMED';
   await query("UPDATE peniel_ops.staff_email_outbox SET status='failed',last_error=$2 WHERE id=$1",[id,code]);
   return {status:'failed'};
  }
 }
 return {dispatch};
}
module.exports={configured,createService};
