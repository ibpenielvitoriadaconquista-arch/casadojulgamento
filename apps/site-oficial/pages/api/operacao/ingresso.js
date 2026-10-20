import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import {query,transaction} from '../../../lib/db';
import live from '../../../lib/operation-live.cjs';
import tickets from '../../../lib/entry-tickets.cjs';

export const config={api:{bodyParser:{sizeLimit:'3kb'}}};
const {EVENT_ID,findEntry,parseTicketCode,assessAdmission,bahiaDay}=tickets;

function registration(rows){
 if(!rows.length)return null;
 const first=rows[0];
 const fingerprint=r=>[r.event_id,r.participant_id,r.even3_registration_id,String(r.participant_name||'').trim()].join('|');
 const conflict=rows.some(r=>fingerprint(r)!==fingerprint(first));
 return {
  event_id:String(first.event_id||''),
  ticket_code:String(first.ticket_code||''),
  participant_id:String(first.participant_id||''),
  participant_name:String(first.participant_name||'').trim(),
  entry_candidate_id:String(first.even3_registration_id||''),
  source_action:String(first.source_action||''),
  conflict
 };
}
async function getTicket(client,code){
 const r=await client.query(
  `SELECT event_id,ticket_code,participant_id,participant_name,even3_registration_id,source_action
    FROM public.cdj_pluga_inscricoes_inbox WHERE ticket_code=$1
    ORDER BY received_at DESC LIMIT 30`,[code]);
 return registration(r.rows);
}
async function getAuthorization(client,code){
 const result=await client.query(
  `SELECT event_id,ticket_code,entry_id,participant_id,participant_name,registration_status,
          payment_status,evidence_reference,verified_at,revoked_at,checked_in_at
    FROM peniel_ops.entry_authorizations
    WHERE event_id=$1 AND ticket_code=$2`,[EVENT_ID,code]);
 return result.rows[0]||null;
}
function publicResult(raw,auth,session,entry,reason,admitted=false,eligible=false){
 return {
  found:!!raw,
  participantName:raw?.participant_name||null,
  entry:entry?{id:entry.entryId,date:entry.session,label:entry.label}:null,
  session,admitted,checkedIn:!!auth?.checked_in_at,
  status:admitted?'admitted':eligible?'ready':'blocked',eligible,message:reason
 };
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try {
  if(req.method!=='POST')throw fail(405,'Método não permitido.');
  sameOrigin(req);
  const user=await actor(req);
  if(!['portaria','geral'].includes(user.role))throw fail(403,'Somente a Portaria ou Gestão Geral podem conferir ingressos.');
  const {code:input,session,action='lookup'}=req.body||{};
  const code=parseTicketCode(input);
  if(!code)throw fail(400,'QR ou código não reconhecido. Digite o código individual mostrado no ingresso.');
  if(!['lookup','admit'].includes(action))throw fail(400,'Ação inválida.');
  if(!tickets.ENTRIES.some(e=>e.session===session))throw fail(400,'Selecione a data da sessão.');

  if(action==='lookup'){
   const raw=await getTicket({query},code);
   if(!raw)return res.status(200).json(publicResult(null,null,session,null,'Código não localizado nos dados recebidos pela Pluga.'));
   const entry=findEntry(raw.entry_candidate_id);
   let auth=null;
   try{auth=await getAuthorization({query},code);}
   catch(e){if(e.code!=='42P01')throw e;} // migration not yet applied: lookup remains safely blocked
   if(auth?.checked_in_at)return res.status(200).json(publicResult(raw,auth,session,entry,'Este ingresso já foi utilizado.'));
   const check=assessAdmission(raw,auth,{
    today:bahiaDay(),enabled:process.env.CDJ_ENTRY_ADMISSION_ENABLED==='true'
   });
   if(entry&&session!==entry.session)return res.status(200).json(publicResult(raw,auth,session,entry,'Este código pertence à sessão '+entry.label+'.'));
   if(!check.ok)return res.status(200).json(publicResult(raw,auth,session,entry,check.reason));
   const mapping=await query(
    'SELECT session_date::text FROM even3_integration.entry_map WHERE event_id=$1 AND entry_id=$2 AND active=true AND verified_at IS NOT NULL',
    [EVENT_ID,entry.entryId]);
   if(mapping.rows[0]?.session_date!==session)return res.status(200).json(publicResult(raw,auth,session,entry,'Categoria ainda não homologada no catálogo Even3.'));
   return res.status(200).json(publicResult(raw,auth,session,entry,check.reason,false,true));
  }

  // Fail closed until the category IDs have been verified with organizer Even3,
  // individual payment linkage is reconciled, and a documented go-live flag is enabled.
  if(process.env.CDJ_ENTRY_ADMISSION_ENABLED!=='true')
   return res.status(423).json({error:'Portaria em homologação. Leitura disponível, mas admissão real ainda não habilitada.'});

  const result=await transaction(async client=>{
   const raw=await getTicket(client,code);
   // This row lock is the single gate for concurrent scanners at either entrance.
   const authorized=await client.query(
    'SELECT * FROM peniel_ops.entry_authorizations WHERE event_id=$1 AND ticket_code=$2 FOR UPDATE',[EVENT_ID,code]);
   const auth=authorized.rows[0]||null;
   if(auth?.checked_in_at)return publicResult(raw,auth,session,findEntry(auth.entry_id),'Este ingresso já foi utilizado.',false);
   const approval=assessAdmission(raw,auth,{today:bahiaDay(),enabled:true});
   if(!approval.ok)return publicResult(raw,auth,session,approval.entry,approval.reason);
   if(approval.entry.session!==session)return publicResult(raw,auth,session,approval.entry,'Este ingresso é de outra sessão.');

   // A distinct verification of the official Even3 catalog has to activate the mapping.
   const verified=await client.query(
    `SELECT session_date::text FROM even3_integration.entry_map
      WHERE event_id=$1 AND entry_id=$2 AND active=true AND verified_at IS NOT NULL`,
    [EVENT_ID,approval.entry.entryId]);
   if(verified.rows[0]?.session_date!==session)
     return publicResult(raw,auth,session,approval.entry,'Categoria ainda não homologada no catálogo Even3.');

   const state=await client.query(
    'SELECT state,revision FROM peniel_ops.session_state WHERE session_date=$1 FOR UPDATE',[session]);
   if(!state.rows[0])throw fail(503,'Sessão ainda não preparada.');
   const db={schema:5,revision:Number(state.rows[0].revision),sessions:{[session]:state.rows[0].state}};
   const next=live.admit(db,session,{
    verified:true,registrationId:code,participantId:raw.participant_id,
    name:raw.participant_name,entryId:approval.entry.entryId
   });
   if(next.duplicate)return publicResult(raw,auth,session,approval.entry,'Ingresso já está na fila da Coordenação.');
   await client.query(
    'UPDATE peniel_ops.session_state SET state=$2::jsonb,revision=$3,updated_at=now() WHERE session_date=$1',
    [session,JSON.stringify(next.db.sessions[session]),next.db.revision]);
   await client.query(
    'UPDATE peniel_ops.entry_authorizations SET checked_in_at=now(),admitted_by=$3,updated_at=now() WHERE event_id=$1 AND ticket_code=$2',
    [EVENT_ID,code,user.user_id]);
   return publicResult(raw,{...auth,checked_in_at:new Date()},session,approval.entry,
    'Entrada registrada. Participante enviado à Coordenação.',true);
  });
  return res.status(200).json(result);
 } catch(e) {
  if(!e.status)console.error('peniel_entry_scan_error',{code:String(e.code||e.name||'unknown').slice(0,70)});
  return res.status(e.status||503).json({error:e.status?e.message:'Consulta indisponível. Não libere a entrada sem confirmação.'});
 }
}
