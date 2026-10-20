import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import {query,transaction} from '../../../lib/db';
import tickets from '../../../lib/entry-tickets.cjs';
import ops from '../../../lib/operation-training.cjs';
export const config={api:{bodyParser:{sizeLimit:'3kb'}}};
const EVENT='798621',DATES=new Set(ops.SESSIONS.map(s=>s.id));
const category=(name,session)=>{const [y,m,d]=session.split('-');return String(name||'').normalize('NFC').trim()===('Casa do Julgamento — '+d+'/'+m+'/'+y).normalize('NFC');};
const person=r=>({id:r.id,code:r.ticket_code,name:r.participant_name,category:r.ticket_category,group:r.group_id||null,scannedAt:r.scanned_at,assignedAt:r.assigned_at||null});
async function generation(db,session,lock=false){const r=await db.query('SELECT generation FROM peniel_ops.qr_rehearsal_sessions WHERE session_date=$1'+(lock?' FOR UPDATE':''),[session]);if(!r.rows[0])throw fail(503,'Ensaio não preparado.');return r.rows[0].generation;}
async function roster(db,session,g){const r=await db.query('SELECT id,ticket_code,participant_name,ticket_category,group_id,scanned_at,assigned_at FROM peniel_ops.qr_rehearsal_arrivals WHERE session_date=$1 AND generation=$2 ORDER BY scanned_at,id',[session,g]);return r.rows.map(person);}
async function attendee(db,code){const r=await db.query('SELECT attendee_id,participant_name,category_name,is_confirmed FROM public.cdj_even3_api_attendees WHERE event_id=$1 AND checkin_code=$2',[EVENT,code]);return r.rows.length===1?r.rows[0]:null;}
function verdict(code,p,session){if(!p)return {found:false,eligible:false,code,session,message:'QR não encontrado na última importação Even3.'};const details={found:true,eligible:false,code,session,name:p.participant_name,category:p.category_name};if(!p.is_confirmed)return {...details,message:'Inscrição não confirmada.'};if(!category(p.category_name,session))return {...details,message:'Ingresso de outra data ou categoria TESTE.'};if(!p.attendee_id||!p.participant_name)return {...details,message:'Cadastro incompleto.'};return {...details,eligible:true,message:'QR identificado para ENSAIO. Pagamento não conciliado, entrada real desativada.'};}
export default async function handler(req,res){
res.setHeader('Cache-Control','private, no-store');
try{if(!['GET','POST'].includes(req.method))throw fail(405,'Método inválido.');if(req.method==='POST')sameOrigin(req);
const user=await actor(req),input=req.method==='GET'?req.query:(req.body||{}),session=String(input.session||'');
if(!DATES.has(session))throw fail(400,'Selecione a sessão.');if(!['geral','portaria','coordenacao'].includes(user.role))throw fail(403,'Sem permissão.');
const action=req.method==='GET'?'queue':String(input.action||'');if(!['queue','lookup','scan','assign','reset'].includes(action))throw fail(400,'Ação inválida.');
if(['lookup','scan'].includes(action)&&!['geral','portaria'].includes(user.role))throw fail(403,'Somente Portaria.');
if(action==='assign'&&!['geral','coordenacao'].includes(user.role))throw fail(403,'Somente Coordenação.');
if(action==='reset'&&user.role!=='geral')throw fail(403,'Somente Gestão Geral.');
if(action==='queue'){const g=await generation({query},session);return res.json({training:true,session,generation:g,people:await roster({query},session,g)});}
if(action==='lookup'){const code=tickets.parseTicketCode(input.code);if(!code)throw fail(400,'QR inválido.');return res.json({training:true,...verdict(code,await attendee({query},code),session)});}
if(action==='scan'){const code=tickets.parseTicketCode(input.code);if(!code)throw fail(400,'QR inválido.');
const result=await transaction(async db=>{const g=await generation(db,session,true),p=await attendee(db,code),check=verdict(code,p,session);if(!check.eligible)return check;
const old=await db.query('SELECT 1 FROM peniel_ops.qr_rehearsal_arrivals WHERE session_date=$1 AND generation=$2 AND ticket_code=$3',[session,g,code]);if(old.rowCount)return {...check,eligible:false,duplicate:true,message:'QR já registrado nesta rodada do ensaio.'};
const count=await db.query('SELECT count(*)::int n FROM peniel_ops.qr_rehearsal_arrivals WHERE session_date=$1 AND generation=$2',[session,g]);if(count.rows[0].n>=300)throw fail(409,'Capacidade de ensaio atingida.');
await db.query('INSERT INTO peniel_ops.qr_rehearsal_arrivals(session_date,generation,ticket_code,attendee_id,participant_name,ticket_category,scanned_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',[session,g,code,p.attendee_id,String(p.participant_name).slice(0,180),p.category_name,user.user_id]);return {...check,recorded:true,message:'QR registrado na fila de ENSAIO. Nenhuma entrada real liberada.'};});
return res.json({training:true,...result});}
if(action==='assign'){const group=String(input.group||''),ids=Array.isArray(input.ids)?[...new Set(input.ids)]:[];if(!/^G(0[1-9]|1[0-5])$/.test(group)||!ids.length||ids.length>20||ids.some(x=>typeof x!=='string'||!/^[0-9a-f-]{36}$/i.test(x)))throw fail(400,'Seleção inválida.');
const data=await transaction(async db=>{const g=await generation(db,session,true),people=await roster(db,session,g),selected=ids.map(id=>people.find(x=>x.id===id));if(selected.some(p=>!p||p.group))throw fail(409,'Pessoa já atribuída ou não encontrada. Atualize.');if(people.filter(p=>p.group===group).length+ids.length>20)throw fail(409,'Grupo excede 20 pessoas.');
const updated=await db.query('UPDATE peniel_ops.qr_rehearsal_arrivals SET group_id=$4,assigned_at=now(),assigned_by=$5 WHERE session_date=$1 AND generation=$2 AND id=ANY($3::uuid[]) AND group_id IS NULL RETURNING id',[session,g,ids,group,user.user_id]);if(updated.rowCount!==ids.length)throw fail(409,'Conflito. Atualize.');return {assigned:updated.rowCount,group};});return res.json({training:true,...data});}
if(action==='reset'){const data=await transaction(async db=>{await generation(db,session,true);const r=await db.query('UPDATE peniel_ops.qr_rehearsal_sessions SET generation=gen_random_uuid(),reset_at=now(),reset_by=$2 WHERE session_date=$1 RETURNING generation',[session,user.user_id]);return {generation:r.rows[0].generation};});return res.json({training:true,reset:true,...data,message:'Apenas ensaio reiniciado. Históricos, inscrições, pagamentos e operação real preservados.'});}
}catch(e){if(!e.status)console.error('qr_ensaio_error',{code:String(e.code||e.name||'unknown').slice(0,45)});return res.status(e.status||503).json({error:e.status?e.message:'Ensaio indisponível. Não libere entrada real.'});}
}