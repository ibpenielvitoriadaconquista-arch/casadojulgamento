'use strict';
const tickets=require('./entry-tickets.cjs'),rules=require('./official-entries.cjs'),cashAuthorization=require('./cash-authorization.cjs'),capacity=require('./admission-capacity.cjs'),{capacityFor}=require('./session-capacity.cjs'),entitlement=require('./even3-entitlement.cjs');
const fail=(status,message)=>Object.assign(new Error(message),{status});
function createService({query,transaction,even3,now=()=>new Date().toISOString()}){
 const today=()=>tickets.bahiaDay(new Date(now()));
 async function execute(user,body={}){
  if(!cashAuthorization.allowed(user?.role,'POST',body)||!user?.user_id)throw fail(403,'Sem permissão para esta conferência.');
  const {code:raw,action,evidence:input,paymentStatus,session}=body,code=tickets.parseTicketCode(raw),inputEvidence=String(input||'').trim();
  const evidence=user.role==='caixa'?`Caixa / ${body.paymentMethod}: ${inputEvidence}`:inputEvidence;
  if(!code||inputEvidence.length<10||evidence.length>500||!['authorize','authorize_date','revoke','confirm_external','retry_external'].includes(action))throw fail(400,'Informe o QR, a ação e a referência verificável da conferência (10–500 caracteres).');
  if(action==='authorize_date'&&(!['geral','coordenacao'].includes(user.role)||body.confirmed!==true))throw fail(403,'Somente Coordenação ou Gestão podem confirmar a exceção após conferir na Even3.');
  const destination=action==='authorize_date'?rules.bySession(session):null;
  if(action==='authorize_date'&&(!destination||!destination.days.includes(today())))throw fail(409,'Selecione a sessão correspondente à data de hoje.');
  const assistantReview=body.assistantReview===true;
  if(assistantReview&&(user.role!=='geral'||body.confirmed!==true))throw fail(403,'Revisão do chat exige confirmação explícita da Gestão Geral.');
  let p,entry;
  if(action==='authorize'||action==='authorize_date'||assistantReview&&['confirm_external','retry_external'].includes(action)){
   if(['authorize','authorize_date'].includes(action)&&!['paid','exempt'].includes(paymentStatus))throw fail(400,'Informe pagamento ou cortesia comprovada.');
   const cached=(await query('SELECT attendee_id FROM public.cdj_even3_api_attendees WHERE event_id=$1 AND checkin_code=$2',[tickets.EVENT_ID,code])).rows;
   if(cached.length!==1)throw fail(409,'QR não localizado de forma única.');
   p=await even3.attendee(cached[0].attendee_id);const catalog=await even3.event();entry=rules.byCatalogCategory(catalog,p.registration_category);
   if(!entry||p.confirmed!==true||String(p.checkin_code)!==code||String(p.id_event)!==tickets.EVENT_ID)throw fail(409,'Inscrição não confirmada ou categoria inválida.');
   if(!rules.catalogMatches(catalog,entry))throw fail(409,'Categoria divergente do catálogo.');
  }
  await transaction(async db=>{
   const authorization=(await db.query('SELECT * FROM peniel_ops.entry_authorizations WHERE event_id=$1 AND ticket_code=$2 FOR UPDATE',[tickets.EVENT_ID,code])).rows[0];
   if(user.role==='caixa'&&authorization?.revoked_at)throw fail(409,'Autorização revogada. A Gestão deve revisar antes de receber nova confirmação.');
   const attempt=(await db.query('SELECT * FROM peniel_ops.entry_checkins WHERE event_id=$1 AND ticket_code=$2 FOR UPDATE',[tickets.EVENT_ID,code])).rows[0];
   if(assistantReview){
    if(authorization?.revoked_at||authorization?.checked_in_at||attempt?.status==='admitted')throw fail(409,'Ingresso revogado ou já utilizado. O chat não remove esse bloqueio.');
    if(['confirm_external','retry_external'].includes(action)){
     const target=rules.bySession(session),attemptDay=attempt?.session_date instanceof Date?attempt.session_date.toISOString().slice(0,10):String(attempt?.session_date||'').slice(0,10);
     if(!target||!target.days.includes(today())||attemptDay!==session)throw fail(409,'Recuperação permitida somente para a sessão em atendimento e a tentativa correspondente.');
     if(!attempt||!body.expectedAttemptRequestedAt||new Date(attempt.requested_at).toISOString()!==body.expectedAttemptRequestedAt)throw fail(409,'A tentativa mudou desde a conferência. Consulte novamente.');
     if(!authorization||!authorization.verified_at||!authorization.evidence_reference||authorization.registration_status!=='confirmed'||String(authorization.participant_id)!==String(p.id_attendees)||authorization.entry_id!==entry.entryId||!(['paid','exempt'].includes(authorization.payment_status)||entitlement.confirmedBasis(authorization,p,entry)))throw fail(409,'Autorização individual não confirmada ou divergente.');
    }
   }
   if(action==='authorize'||action==='authorize_date'){
    if(attempt||authorization?.checked_in_at)throw fail(409,'Ingresso já possui credenciamento em processamento ou concluído.');
    if(action==='authorize_date'){
     if(authorization?.revoked_at)throw fail(409,'Autorização revogada. A Gestão deve revisar antes da exceção.');
     const target=(await db.query('SELECT state FROM peniel_ops.session_state WHERE session_date=$1 FOR UPDATE',[destination.session])).rows[0];
     if(!target)throw fail(503,'Sessão de destino indisponível.');
     const pending=await capacity.reservations(db,tickets.EVENT_ID,destination.session,today(),code);
     if(target.state.people.length+pending>=capacityFor(destination.session).total)throw fail(409,'Sessão sem vagas disponíveis para autorizar outra entrada.');
    }
    await db.query(`INSERT INTO peniel_ops.entry_authorizations(event_id,ticket_code,entry_id,participant_id,participant_name,registration_status,payment_status,evidence_reference,verified_at) VALUES($1,$2,$3,$4,$5,'confirmed',$6,$7,now()) ON CONFLICT(event_id,ticket_code) DO UPDATE SET entry_id=excluded.entry_id,participant_id=excluded.participant_id,participant_name=excluded.participant_name,registration_status='confirmed',payment_status=excluded.payment_status,evidence_reference=excluded.evidence_reference,verified_at=now(),revoked_at=null,updated_at=now() WHERE peniel_ops.entry_authorizations.checked_in_at IS NULL`,[tickets.EVENT_ID,code,entry.entryId,String(p.id_attendees),p.name,paymentStatus,evidence]);
   }else if(action==='revoke'){
    if(attempt?.status==='admitted')throw fail(409,'Entrada já utilizada; preserve o histórico e procure a coordenação.');
    await db.query("UPDATE peniel_ops.entry_authorizations SET revoked_at=now(),registration_status='cancelled',updated_at=now() WHERE event_id=$1 AND ticket_code=$2",[tickets.EVENT_ID,code]);
   }else{
    if(!attempt||!['sending','uncertain','rejected'].includes(attempt.status)||new Date(now()).getTime()-new Date(attempt.requested_at).getTime()<60000)throw fail(409,'Conferência permitida somente para tentativa pendente há mais de um minuto.');
    if(action==='confirm_external')await db.query("UPDATE peniel_ops.entry_checkins SET status='confirmed',confirmed_at=now(),response_code='operator_verified',resolved_by=$3,resolution_evidence=$4,updated_at=now() WHERE event_id=$1 AND ticket_code=$2",[tickets.EVENT_ID,code,user.user_id,evidence]);
    else {
     // Audit preserves the old attempt before allowing a new send. Only after organizer verified absence externally.
     await db.query('DELETE FROM peniel_ops.entry_checkins WHERE event_id=$1 AND ticket_code=$2',[tickets.EVENT_ID,code]);
    }
   }
   await db.query('INSERT INTO peniel_ops.entry_financial_audit(event_id,ticket_code,actor_id,action,evidence) VALUES($1,$2,$3,$4,$5)',[tickets.EVENT_ID,code,user.user_id,action,JSON.stringify({reference:evidence,session:destination?.session,sourceEntryId:entry?.entryId,day:action==='authorize_date'?today():undefined,previousAttempt:attempt?{status:attempt.status,requestedAt:attempt.requested_at,response:attempt.response_code}:null})]);
  });
  return {ok:true,message:action==='confirm_external'?'Conferência manual da Even3 registrada. A Portaria pode concluir a entrada sem reenviar.':action==='retry_external'?'Nova tentativa habilitada após conferência do gestor. Nenhum credenciamento foi reenviado; a Portaria deve consultar e tentar novamente.':'Conferência registrada com auditoria.'};
 }
 return {execute};
}
module.exports={createService};
