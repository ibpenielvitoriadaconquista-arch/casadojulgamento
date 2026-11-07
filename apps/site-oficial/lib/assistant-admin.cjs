"use strict";
const tickets=require('./entry-tickets.cjs'),rules=require('./official-entries.cjs');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const iso=x=>x?new Date(x).toISOString():null;
const {TITLES,commandFor}=require('./assistant-actions.cjs');
function eligibleActions({result,authorization:a,attempt:c,session,now}){
 if(result.training||result.registrationConfirmed!==true||result.checkedIn||a?.checked_in_at||a?.revoked_at||c?.status==='admitted')return [];
 if(!c)return ['payment'];
 const target=rules.bySession(session),day=tickets.bahiaDay(new Date(now));
 const attemptDay=c.session_date instanceof Date?c.session_date.toISOString().slice(0,10):String(c.session_date||'').slice(0,10);
 const age=new Date(now).getTime()-new Date(c.requested_at).getTime();
 const basis=!!a&&a.registration_status==='confirmed'&&!!a.verified_at&&!!a.evidence_reference&&a.entry_id===result.entry?.id&&(['paid','exempt'].includes(a.payment_status)||a.evidence_reference===`even3-confirmed-registration:798621:${a.participant_id}:${a.entry_id}`);
 if(target?.days.includes(day)&&attemptDay===session&&basis&&age>=60000&&['sending','uncertain','rejected'].includes(c.status))return ['external_confirmed','external_retry'];
 return [];
}

function createService({query,lookup,now=()=>new Date().toISOString(),uuid=require('node:crypto').randomUUID}){
 async function diagnose(code,session){
  const {result}=await lookup(code,session);
  if(result.training)return {code,session,result,actions:[],note:'Ingresso fictício: não há pagamento ou credenciamento Even3. Use a homologação isolada para testar ações administrativas.'};
  const a=(await query('SELECT payment_status,evidence_reference,verified_at,registration_status,revoked_at,checked_in_at,participant_id,entry_id FROM peniel_ops.entry_authorizations WHERE event_id=$1 AND ticket_code=$2',[tickets.EVENT_ID,code])).rows[0]||null;
  const c=(await query('SELECT status,session_date,requested_at,confirmed_at,admitted_at,response_code FROM peniel_ops.entry_checkins WHERE event_id=$1 AND ticket_code=$2',[tickets.EVENT_ID,code])).rows[0]||null;
  const audit=(await query('SELECT action,evidence,created_at FROM peniel_ops.entry_financial_audit WHERE event_id=$1 AND ticket_code=$2 ORDER BY id DESC LIMIT 6',[tickets.EVENT_ID,code])).rows;
  const actions=eligibleActions({result,authorization:a,attempt:c,session,now:now()});
  return {code,session,result,authorization:a,attempt:c,audit,actions,financialBasis:a?.evidence_reference?.startsWith('even3-confirmed-registration:')?'Inscrição confirmada, sem prova individual de dinheiro recebido':a?.evidence_reference?'Conferência individual registrada; verificar referência e histórico':'Sem evidência financeira local',note:'Nenhuma ação executada. Recuperação exige o gestor conferir no painel Even3 se houve credenciamento. Venda presencial confirmada segue a responsabilidade do caixa; não é conciliação financeira automática.'};
 }
 async function prepare(kind,code,session,ctx){
  if(ctx.user?.role!=='geral'||!ctx.user.user_id||!ctx.threadId)throw fail(403,'Gestão Geral e conversa autenticada são obrigatórias.');
  if(!Object.hasOwn(TITLES,kind))throw fail(400,'Ação administrativa não permitida.');
  const d=await diagnose(code,session);
  if(!d.actions.includes(kind))throw fail(409,'Ação indisponível. Confira inscrição, uso, revogação, tentativa, sessão e prazo mínimo de um minuto.');
  const proposal={id:uuid(),kind,title:TITLES[kind],code,name:d.result.participantName,original:d.result.entry.label,target:session,targetLabel:rules.bySession(session).label,expectedAttemptRequestedAt:iso(d.attempt?.requested_at),expiresAt:new Date(new Date(now()).getTime()+300000).toISOString()};
  await query('INSERT INTO peniel_ops.assistant_proposals(id,thread_id,owner_id,payload,expires_at) VALUES($1,$2,$3,$4::jsonb,$5)',[proposal.id,ctx.threadId,ctx.user.user_id,JSON.stringify(proposal),proposal.expiresAt]);ctx.proposals.push(proposal);
  return {proposal,authorized:false,command:commandFor(proposal),instruction:'Mostrar identidade, ação e consequências. O gestor deve conferir a evidência e enviar o comando por conta própria. O agente não preenche nem envia essa confirmação. Não há admissão nem reenvio automático.'};
 }
 return {diagnose,prepare};
}
module.exports={createService,eligibleActions,commandFor,TITLES};
