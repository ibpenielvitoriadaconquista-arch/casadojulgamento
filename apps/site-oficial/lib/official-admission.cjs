'use strict';
const rules=require('./official-entries.cjs'),tickets=require('./entry-tickets.cjs'),live=require('./operation-live.cjs');
const {capacityFor}=require('./session-capacity.cjs');
const caravans=require('./caravans.cjs');
const entitlement=require('./even3-entitlement.cjs');
const capacity=require('./admission-capacity.cjs');
const EVENT=tickets.EVENT_ID;
const fail=(status,message)=>Object.assign(new Error(message),{status});
function createService({query,transaction,even3,now=()=>new Date().toISOString()}){
 async function validOverride(db,code,source,target){
  const rows=(await db.query("SELECT action,evidence FROM peniel_ops.entry_financial_audit WHERE event_id=$1 AND ticket_code=$2 AND action IN ('authorize_date','revoke') ORDER BY id DESC LIMIT 1",[EVENT,code])).rows;
  if(!rows.length||rows[0].action!=='authorize_date')return false;
  let evidence;try{evidence=typeof rows[0].evidence==='string'?JSON.parse(rows[0].evidence):rows[0].evidence;}catch{return false;}
  return evidence?.session===target.session&&evidence?.sourceEntryId===source.entryId&&evidence?.day===tickets.bahiaDay(new Date(now()));
 }
 async function load(code,session,{forLookup=false}={}){
  const destination=rules.bySession(session);if(!destination)throw fail(400,'Selecione uma entrada oficial.');
  const cached=await query('SELECT attendee_id FROM public.cdj_even3_api_attendees WHERE event_id=$1 AND checkin_code=$2',[EVENT,code]);
  if(cached.rows.length>1)throw fail(409,'QR associado a mais de uma inscrição. Procure a Gestão.');
  let attendeeId=cached.rows[0]?.attendee_id;
  if(!attendeeId){
   const response=await even3.request('attendees/'),all=even3.items(response);
   if(Number(response.count)!==all.length)throw fail(503,'Lista Even3 incompleta. Procure a Gestão.');
   const matches=all.filter(x=>String(x.id_event)===EVENT&&String(x.checkin_code)===code);
   if(matches.length!==1)throw fail(409,'QR não localizado de forma única na Even3.');
   const fresh=matches[0];attendeeId=String(fresh.id_attendees);
   await query(`INSERT INTO public.cdj_even3_api_attendees(event_id,attendee_id,checkin_code,participant_name,participant_email,category_name,is_confirmed,upstream_version,retrieved_at) VALUES($1,$2,$3,$4,$5,$6,$7,'v1',now()) ON CONFLICT(event_id,attendee_id) DO UPDATE SET checkin_code=excluded.checkin_code,participant_name=excluded.participant_name,participant_email=excluded.participant_email,category_name=excluded.category_name,is_confirmed=excluded.is_confirmed,retrieved_at=now()`,[EVENT,attendeeId,code,fresh.name,fresh.email,fresh.registration_category,fresh.confirmed]);
  }
  const [p,event]=await Promise.all([even3.attendee(attendeeId),even3.event()]);
  if(String(p.checkin_code)!==code)throw fail(409,'O QR diverge da inscrição Even3.');
  const entry=rules.byCatalogCategory(event,p.registration_category);
  if(!entry)throw fail(409,'Categoria do ingresso não reconhecida. Procure a Gestão.');
  const today=tickets.bahiaDay(new Date(now()));
  const invalid=rules.validate(p,entry,entry.days[0]);
  if(!rules.catalogMatches(event,entry))throw fail(409,'Categoria não corresponde ao catálogo atual da Even3.');
  const destinationOpen=rules.sessionOpen(destination,today);
  const otherDate=entry.session!==destination.session||!entry.days.includes(today);
  const override=destinationOpen&&otherDate&&!invalid?await validOverride({query},code,entry,destination):false;
  const blockedReason=invalid||(!destinationOpen?'Sessão selecionada fora da data de atendimento. A consulta está disponível, mas a entrada permanece bloqueada.':otherDate&&!override&&destination.session!==rules.LOT.session?'Ingresso de outra data. Coordenação ou Gestão devem conferir as vagas e autorizar a exceção.':null);
  if(blockedReason&&!forLookup)throw fail(409,blockedReason);
  if(!blockedReason)await entitlement.authorize({p,entry,query});
  return {p,entry,destination,blockedReason,needsDateAuthorization:!invalid&&destinationOpen&&otherDate&&!override&&destination.session!==rules.LOT.session};
 }
 const result=(p,entry,extra={})=>({found:true,participantName:p.name,registrationConfirmed:p.confirmed===true,entry:{id:entry.entryId,date:entry.session,label:entry.label},session:entry.session,admitted:false,eligible:false,checkedIn:false,status:'blocked',...extra});
 async function lookup(code,session){
  const {p,entry,destination,blockedReason,needsDateAuthorization}=await load(code,session,{forLookup:true});
  const attempt=(await query('SELECT status FROM peniel_ops.entry_checkins WHERE event_id=$1 AND ticket_code=$2',[EVENT,code])).rows[0];
  if(attempt?.status==='admitted')return result(p,entry,{checkedIn:true,message:'Ingresso já utilizado. Não autorize outra entrada.'});
  if(attempt&&['sending','uncertain'].includes(attempt.status))return result(p,entry,{message:'Credenciamento em processamento ou aguardando conferência da Gestão. Não repita a entrada.'});
  const auth=(await query('SELECT * FROM peniel_ops.entry_authorizations WHERE event_id=$1 AND ticket_code=$2',[EVENT,code])).rows[0];
  if(auth?.checked_in_at)return result(p,entry,{checkedIn:true,message:'Ingresso já utilizado.'});
  if(auth?.revoked_at)return result(p,entry,{message:'Autorização revogada. Procure a Gestão.'});
  if(blockedReason){
   let availability;
   if(needsDateAuthorization){
    const queue=(await query('SELECT state FROM peniel_ops.session_state WHERE session_date=$1',[session])).rows[0];
    if(queue){const reserved=await capacity.reservations({query},EVENT,session,tickets.bahiaDay(new Date(now())),code),limit=capacityFor(session).total;availability={limit,arrived:queue.state.people.length,reserved,remaining:Math.max(0,limit-queue.state.people.length-reserved)};}
   }
   return result(p,entry,{needsDateAuthorization,availability,message:blockedReason});
  }
  const reason=authorizationReason(auth,p,entry);
  if(reason)return result(p,entry,{message:reason,needsAuthorization:true});
  const queue=caravans.enabled(session)?(await query('SELECT state FROM peniel_ops.session_state WHERE session_date=$1',[session])).rows[0]?.state:null;
  const caravan=queue?caravans.identity(queue,code):null;
  let availability;
  const trainingDateAutomatic=destination.session===rules.LOT.session;
  if(trainingDateAutomatic){
   if(!queue)throw fail(503,'Sessão de treinamento indisponível.');
   const reserved=await capacity.reservations({query},EVENT,session,tickets.bahiaDay(new Date(now())),code),limit=capacityFor(session).total;
   availability={limit,arrived:queue.people.length,reserved,remaining:Math.max(0,limit-queue.people.length-reserved)};
   if(!availability.remaining)return result(p,entry,{availability,message:'Sessão de treinamento lotada.'});
  }
  return result(p,entry,{eligible:true,status:'ready',caravan,trainingDateAutomatic,availability,needsDateAuthorization:false,entry:{id:entry.entryId,date:destination.session,label:entry.label+(entry.session!==destination.session?' → '+destination.label:'')},message:trainingDateAutomatic&&attempt?.status!=='confirmed'?'Lote 1: data liberada automaticamente para treinamento. Confirmar chegada fará credenciamento REAL na Even3 e consumirá este ingresso.':attempt?.status==='confirmed'?'Even3 já confirmou. Concluir encaminhamento à Coordenação.':'Ingresso validado. Confirme para credenciar na Even3 e liberar a entrada.'});
 }
 function authorizationReason(a,p,e){
  if(!a)return 'Autorização individual não localizada. Procure a Gestão.';
  if(a.checked_in_at)return 'Ingresso já utilizado.';
  if(a.revoked_at||a.registration_status!=='confirmed'||(!['paid','exempt'].includes(a.payment_status)&&!entitlement.confirmedBasis(a,p,e))||String(a.participant_id)!==String(p.id_attendees)||a.entry_id!==e.entryId||!a.verified_at||!a.evidence_reference)return 'Autorização revogada ou divergente. Procure a Gestão.';
  return null;
 }
 async function finalize(code){
  return transaction(async db=>{
   // All callers lock authorization -> attempt -> session in the same order.
   const auth=(await db.query('SELECT * FROM peniel_ops.entry_authorizations WHERE event_id=$1 AND ticket_code=$2 FOR UPDATE',[EVENT,code])).rows[0];
   const a=(await db.query('SELECT * FROM peniel_ops.entry_checkins WHERE event_id=$1 AND ticket_code=$2 FOR UPDATE',[EVENT,code])).rows[0];
   if(!a||!['confirmed','admitted'].includes(a.status))throw fail(409,'Even3 ainda não confirmou este credenciamento.');
   const destination=rules.bySession(a.session_date instanceof Date?a.session_date.toISOString().slice(0,10):String(a.session_date).slice(0,10));
   const entry=rules.ENTRIES.find(e=>e.entryId===a.entry_id);
   if(!entry||!destination)throw fail(409,'Entrada ou sessão não reconhecida.');
   const p={name:a.participant_name,id_attendees:a.attendee_id};
   if(a.status==='admitted')return result(p,entry,{checkedIn:true,message:'Ingresso já utilizado. Não autorize outra entrada.'});
   const reason=authorizationReason(auth,p,entry);if(reason)throw fail(409,reason);
   if(!rules.sessionOpen(destination,tickets.bahiaDay(new Date(now()))))throw fail(409,'A data de admissão terminou. Procure a Gestão.');
   if(destination.session!==rules.LOT.session&&(entry.session!==destination.session||!entry.days.includes(tickets.bahiaDay(new Date(now()))))&&!await validOverride(db,code,entry,destination))throw fail(409,'Exceção de data não autorizada ou expirada.');
   const row=(await db.query('SELECT state,revision FROM peniel_ops.session_state WHERE session_date=$1 FOR UPDATE',[destination.session])).rows[0];
   if(!row)throw fail(503,'Fila oficial indisponível.');
   const next=live.admit({schema:5,revision:Number(row.revision),sessions:{[destination.session]:row.state}},destination.session,{verified:true,participantId:a.attendee_id,registrationId:code,entryId:entry.entryId,name:a.participant_name},a.requested_at);
   if(!next.duplicate)await db.query('UPDATE peniel_ops.session_state SET state=$2::jsonb,revision=$3,updated_at=now() WHERE session_date=$1',[destination.session,JSON.stringify(next.db.sessions[destination.session]),next.db.revision]);
   await db.query('UPDATE peniel_ops.entry_authorizations SET checked_in_at=now(),admitted_by=$3,updated_at=now() WHERE event_id=$1 AND ticket_code=$2',[EVENT,code,a.requested_by]);
   await db.query("UPDATE peniel_ops.entry_checkins SET status='admitted',admitted_at=now(),updated_at=now() WHERE event_id=$1 AND ticket_code=$2",[EVENT,code]);
   return result(p,entry,{admitted:true,checkedIn:true,status:'admitted',even3Confirmed:true,caravan:caravans.identity(next.db.sessions[destination.session],code),message:'Credenciamento confirmado pela Even3. Entrada registrada e participante enviado à Coordenação.'});
  });
 }
 async function admit(code,session,user){
  const {p,entry}=await load(code,session);
  const reserved=await transaction(async db=>{
   const auth=(await db.query('SELECT * FROM peniel_ops.entry_authorizations WHERE event_id=$1 AND ticket_code=$2 FOR UPDATE',[EVENT,code])).rows[0];
   const reason=authorizationReason(auth,p,entry);if(reason)throw fail(409,reason);
   const old=(await db.query('SELECT status,requested_at FROM peniel_ops.entry_checkins WHERE event_id=$1 AND ticket_code=$2 FOR UPDATE',[EVENT,code])).rows[0];
   if(old?.status==='confirmed')return {confirmed:true};
   if(old)throw fail(409,'Já existe uma tentativa de credenciamento. Procure a Gestão para conferir o resultado.');
   const state=(await db.query('SELECT state FROM peniel_ops.session_state WHERE session_date=$1 FOR UPDATE',[session])).rows[0];
   if(!state)throw fail(503,'Fila oficial indisponível.');
   if(state.state.closedAt)throw fail(409,'Apresentação encerrada. Nenhum credenciamento foi enviado à Even3.');
   const reservations=await capacity.reservations(db,EVENT,session,tickets.bahiaDay(new Date(now())),code);
   if(state.state.people.length+reservations>=capacityFor(session).total)throw fail(409,'Sessão lotada. Procure a Coordenação.');
   const at=now();
   await db.query("INSERT INTO peniel_ops.entry_checkins(event_id,ticket_code,entry_id,attendee_id,participant_name,session_date,status,requested_at,requested_by) VALUES($1,$2,$3,$4,$5,$6,'sending',$7,$8)",[EVENT,code,entry.entryId,String(p.id_attendees),p.name,session,at,user.user_id]);
   return {at};
  });
  if(!reserved.confirmed){
   try{await even3.checkin(code,reserved.at);}
   catch(e){await query("UPDATE peniel_ops.entry_checkins SET status='uncertain',last_error=$3,updated_at=now() WHERE event_id=$1 AND ticket_code=$2 AND status='sending'",[EVENT,code,'Resposta não confirmada; conferir na Even3 antes de repetir.']);throw fail(502,'Não foi possível confirmar a resposta da Even3. Ingresso reservado para conferência pela Gestão; não libere a entrada.');}
   await query("UPDATE peniel_ops.entry_checkins SET status='confirmed',confirmed_at=now(),response_code='OK',updated_at=now() WHERE event_id=$1 AND ticket_code=$2 AND status='sending'",[EVENT,code]);
  }
  return finalize(code);
 }
 return {load,lookup,admit,finalize};
}
module.exports={createService};
