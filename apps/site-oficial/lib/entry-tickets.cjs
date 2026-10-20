'use strict';
// Official entry IDs are categories, NOT individual admission codes.
// Provisional mapping supplied by the organizer; live admissions remain gated
// until authenticated Even3 catalog and Pluga financial reconciliation pass.
const EVENT_ID='798621';
const ENTRIES=Object.freeze([
  {entryId:'968577',session:'2026-11-09',label:'09/11 · 17h'},
  {entryId:'968578',session:'2026-11-13',label:'13/11 · 20h'},
  {entryId:'968579',session:'2026-11-14',label:'14/11 · 18h'},
  {entryId:'968580',session:'2026-11-19',label:'19/11 · 20h'},
  {entryId:'968581',session:'2026-11-20',label:'20/11 · 17h'},
  {entryId:'968582',session:'2026-11-21',label:'21/11 · 18h'}
]);
const findEntry=id=>ENTRIES.find(e=>e.entryId===String(id||''))||null;
function parseTicketCode(raw){
  if(typeof raw!=='string'||raw.length>512)return null;
  let value=raw.trim();
  if(/^https:\/\//i.test(value)){
    let url;
    try{url=new URL(value);}catch{return null;}
    const host=url.hostname.toLowerCase();
    if(host!=='even3.com.br'&&!host.endsWith('.even3.com.br'))return null;
    const keys=['check_in_code','checkin_code','ticket_code','codigo'];
    const values=keys.flatMap(k=>url.searchParams.getAll(k));
    if(values.length!==1)return null;
    value=values[0];
  }
  // Never treat idIngresso/entry/category/sale id as an individual check-in.
  return /^[0-9]{6,20}$/.test(value)?value:null;
}
function bahiaDay(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return values.year+'-'+values.month+'-'+values.day;
}
// The Pluga webhook is evidence of a registration, not payment evidence.
// A separate, explicitly verified financial link is required to admit.
function assessAdmission(raw,authorized,{today=bahiaDay(),enabled=false}={}){
  if(!raw)return {ok:false,reason:'Ingresso ainda não encontrado na base Pluga.'};
  if(String(raw.event_id)!==EVENT_ID)return {ok:false,reason:'Este ingresso não pertence ao evento.'};
  // An Even3 registration ID is NOT a category ID. A date cannot be inferred from
  // data.inscricao.id, a ticket title, or the purchase date.
  // Only the separately reconciled authorization may identify the official entry.
  const category=String(raw.ticket_category||'').trim();
  if(/^(teste|ingresso\s+geral)\b/i.test(category))
    return {ok:false,reason:'Categoria de teste ou ingresso geral sem data oficial. Não autorizar entrada.'};
  if(raw.source_action!=='registration_confirmed')
    return {ok:false,reason:'Inscrição não confirmada ou cancelada. Encaminhe à conferência.'};
  if(raw.conflict)return {ok:false,reason:'Dados divergentes para este código. Encaminhe à conferência.'};
  if(!authorized)
    return {ok:false,reason:'Inscrição localizada. A data individual e o pagamento ainda não foram conciliados.'};
  const entry=findEntry(authorized.entry_id);
  if(!entry)return {ok:false,reason:'Ingresso sem categoria oficial comprovada (seis entradas por data).'};
  if(String(authorized.event_id)!==EVENT_ID||
     String(authorized.ticket_code)!==String(raw.ticket_code)||
     String(authorized.entry_id)!==entry.entryId||
     String(authorized.participant_id)!==String(raw.participant_id)||
     authorized.registration_status!=='confirmed'||
     !['paid','exempt'].includes(authorized.payment_status)||
     !authorized.verified_at||!String(authorized.evidence_reference||'').trim()||
     authorized.revoked_at)
     return {ok:false,entry,reason:'Verificação financeira/identidade pendente ou revogada.'};
  if(today!==entry.session)return {ok:false,entry,reason:'Ingresso de '+entry.label+'. Não autorizar em outra data.'};
  if(!enabled)return {ok:false,entry,reason:'Leitor em homologação. A admissão real ainda não foi habilitada.'};
  return {ok:true,entry,reason:'Ingresso apto para confirmação de entrada.'};
}
module.exports={EVENT_ID,ENTRIES,findEntry,parseTicketCode,bahiaDay,assessAdmission};
