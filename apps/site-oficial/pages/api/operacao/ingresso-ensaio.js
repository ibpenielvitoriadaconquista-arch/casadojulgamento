import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import {query,transaction} from '../../../lib/db';
import tickets from '../../../lib/entry-tickets.cjs';
import bridge from '../../../lib/even3-ticket-bridge.cjs';
import live from '../../../lib/operation-live.cjs';
const {EVENT_ID,parseTicketCode}=tickets;
export const config={api:{bodyParser:{sizeLimit:'3kb'}}};
function decision(code,p,session){
 const entry=bridge.entryFromCategory(p?.category_name);
 const result={found:!!p,participantName:p?.participant_name||null,entry:entry?{id:entry.entryId,date:entry.session,label:entry.label}:null,session,admitted:false,checkedIn:false,eligible:false,status:'blocked',message:'Código não encontrado na API Even3.',rehearsal:true};
 if(!p)return result;
 if(!p.is_confirmed){result.message='Inscrição ainda não confirmada na Even3.';return result;}
 if(!entry||entry.session!==session){result.message='Categoria TESTE, desconhecida ou ingresso de outra data.';return result;}
 if(!p.attendee_id||!p.participant_name){result.message='Dados de ingresso incompletos.';return result;}
 result.eligible=true;result.status='ready';result.message='QR reconhecido para ENSAIO. Pagamento não conciliado. NÃO autoriza entrada real.';return result;
}
async function getOne(db,code){
 const r=await db.query('SELECT event_id,attendee_id,participant_name,category_name,is_confirmed FROM public.cdj_even3_api_attendees WHERE event_id=$1 AND checkin_code=$2',[EVENT_ID,code]);
 if(r.rows.length!==1)return null;
 return r.rows[0];
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 try {
  if(req.method!=='POST')throw fail(405,'Método inválido.');sameOrigin(req);
  const user=await actor(req);if(!['portaria','geral'].includes(user.role))throw fail(403,'Somente Portaria ou Gestão Geral.');
  const {session,code:raw,action='lookup'}=req.body||{};
  if(!tickets.ENTRIES.some(e=>e.session===session)||!['lookup','admit'].includes(action))throw fail(400,'Parâmetros inválidos.');
  const code=parseTicketCode(raw);if(!code)throw fail(400,'QR inválido. Digite o código individual mostrado no ingresso.');
  if(action==='lookup'){return res.json(decision(code,await getOne({query},code),session));}
  const result=await transaction(async db=>{
   const state=await db.query('SELECT state,revision FROM peniel_ops.ensaios_session_state WHERE session_date=$1 FOR UPDATE',[session]);
   if(!state.rows[0])throw fail(503,'Ensaio não preparado.');
   const candidate=await getOne(db,code),check=decision(code,candidate,session);
   if(!check.eligible)return check;
   const dbState={schema:5,revision:Number(state.rows[0].revision),sessions:{[session]:state.rows[0].state}};
   const updated=live.admit(dbState,session,{verified:true,participantId:candidate.attendee_id,registrationId:code,entryId:check.entry.id,name:candidate.participant_name});
   if(updated.duplicate)return {...check,eligible:false,status:'blocked',message:'QR já registrado neste ensaio. Não duplicar.'};
   await db.query('UPDATE peniel_ops.ensaios_session_state SET state=$2::jsonb,revision=$3,updated_at=now() WHERE session_date=$1',[session,JSON.stringify(updated.db.sessions[session]),updated.db.revision]);
   return {...check,admitted:true,eligible:false,status:'admitted',message:'Participante enviado à Coordenação SOMENTE NO ENSAIO. Ingresso real não consumido.'};
  });
  return res.json(result);
 }catch(e){if(!e.status)console.error('ensaio_qr_error',{code:String(e.code||e.name||'unknown').slice(0,40)});return res.status(e.status||503).json({error:e.status?e.message:'Leitor de ensaio indisponível. Não libere a entrada real.'});}
}