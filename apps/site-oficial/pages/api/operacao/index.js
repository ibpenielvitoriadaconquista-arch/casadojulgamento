import {createHash} from 'node:crypto';
import {query,transaction} from '../../../lib/db';
import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import ops from '../../../lib/operation-training.cjs';
import live from '../../../lib/operation-live.cjs';
export const config={api:{bodyParser:{sizeLimit:'16kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(!['GET','POST'].includes(req.method))throw fail(405,'Método não permitido.');
  if(req.method==='POST')sameOrigin(req);
  const user=await actor(req),input=req.method==='GET'?req.query:req.body;
  const session=input?.session,role=input?.role;
  if(!ops.SESSIONS.some(s=>s.id===session)||!Object.hasOwn(ops.ROLES,role))throw fail(400,'Sessão ou posto inválido.');
  if(user.role!=='geral'&&role!==user.role)throw fail(403,'Este posto não pertence ao seu acesso.');
  const wrap=row=>({schema:5,revision:Number(row.revision),sessions:{[session]:row.state}});
  if(req.method==='GET'){
   const r=await query('SELECT state,revision FROM peniel_ops.session_state WHERE session_date=$1',[session]);
   if(!r.rows[0])throw fail(503,'Sessão ainda não preparada.');
   return res.json({db:live.project(wrap(r.rows[0]),role),role});
  }
  const {action,arg={},revision,requestId}=input;
  if(!Number.isSafeInteger(revision)||typeof requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(requestId))throw fail(400,'Comando inválido.');
  const hash=createHash('sha256').update(JSON.stringify({session,role,action,arg,revision})).digest('hex');
  const result=await transaction(async client=>{
   // Serialize every mutation of a session, including the future Even3 arrival worker.
   const r=await client.query('SELECT state,revision FROM peniel_ops.session_state WHERE session_date=$1 FOR UPDATE',[session]);
   if(!r.rows[0])throw fail(503,'Sessão não preparada.');
   const prev=await client.query('SELECT payload_hash,message FROM peniel_ops.command_log WHERE session_date=$1 AND actor_id=$2 AND request_id=$3',[session,user.user_id,requestId]);
   if(prev.rows[0]){
    if(prev.rows[0].payload_hash!==hash)throw fail(409,'Identificador de comando reutilizado.');
    return {db:wrap(r.rows[0]),message:prev.rows[0].message};
   }
   if(Number(r.rows[0].revision)!==revision)throw fail(409,'Outro colaborador atualizou a sessão. Atualize e confira a seleção antes de repetir.');
   let next;
   if(action==='caravanAdmit'){
    const reservations=await client.query("SELECT count(*)::int AS total FROM peniel_ops.entry_checkins WHERE session_date=$1 AND status IN ('sending','uncertain','confirmed')",[session]);
    if(r.rows[0].state.people.length+reservations.rows[0].total>=ops.capacityFor(session).total)throw fail(409,'Sessão lotada ou com vagas reservadas para credenciamentos em andamento.');
   }
   try{next=live.command(wrap(r.rows[0]),session,role,action,{...arg,actorId:user.user_id});}catch(e){throw fail(422,e.message);}
   await client.query('UPDATE peniel_ops.session_state SET state=$2::jsonb,revision=$3,updated_at=now() WHERE session_date=$1',[session,JSON.stringify(next.db.sessions[session]),next.db.revision]);
   await client.query('INSERT INTO peniel_ops.command_log(session_date,actor_id,request_id,payload_hash,action,message,revision) VALUES($1,$2,$3,$4,$5,$6,$7)',[session,user.user_id,requestId,hash,action,next.message,next.db.revision]);
   return next;
  });
  return res.json({...result,db:live.project(result.db,role)});
 }catch(e){if(!e.status)console.error('official_operation_api_failure',{code:String(e.code||e.name||'unknown').slice(0,60),method:req.method});return res.status(e.status||503).json({error:e.status?e.message:'Servidor da operação não conseguiu consultar o banco. Nenhuma confirmação foi recebida; tente novamente.'});}
}
