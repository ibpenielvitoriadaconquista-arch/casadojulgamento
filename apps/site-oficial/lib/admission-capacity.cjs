'use strict';
// Call while holding the target session row lock. Exclude the ticket being handled.
async function reservations(db,event,session,day,exclude=''){
 const pending=Number((await db.query("SELECT count(*)::int AS total FROM peniel_ops.entry_checkins WHERE session_date=$1 AND status IN ('sending','uncertain','confirmed') AND ticket_code<>$2",[session,exclude])).rows[0].total);
 const overrides=Number((await db.query(`SELECT count(*)::int AS total FROM (
  SELECT DISTINCT ON(ticket_code) ticket_code,action,evidence FROM peniel_ops.entry_financial_audit WHERE event_id=$1 AND action IN ('authorize_date','revoke') ORDER BY ticket_code,id DESC
 ) latest JOIN peniel_ops.entry_authorizations a ON a.event_id=$1 AND a.ticket_code=latest.ticket_code
 WHERE latest.action='authorize_date' AND (latest.evidence::jsonb)->>'session'=$2 AND (latest.evidence::jsonb)->>'day'=$3
 AND a.revoked_at IS NULL AND a.checked_in_at IS NULL AND latest.ticket_code<>$4
 AND NOT EXISTS(SELECT 1 FROM peniel_ops.entry_checkins c WHERE c.event_id=$1 AND c.ticket_code=latest.ticket_code)`,[event,session,day,exclude])).rows[0].total);
 return pending+overrides;
}
module.exports={reservations};
