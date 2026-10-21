import {createHash} from 'node:crypto';
import {query,transaction} from '../../../lib/db';
import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import ops from '../../../lib/operation-training.cjs';
import live from '../../../lib/operation-live.cjs';
export const config={api:{bodyParser:{sizeLimit:'16kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 try {
  if(!['GET','POST'].includes(req.method))throw fail(405,'Método inválido.');
  if(req.method==='POST')sameOrigin(req);
  const user=await actor(req),input=req.method==='GET'?req.query:req.body;
  const {session,role}=input||{};
  if(!ops.SESSIONS.some(x=>x.id===session)||!Object.hasOwn(ops.ROLES,role))throw fail(400,'Sessão ou posto inválido.');
  if(user.role!=='geral'&&user.role!==role)throw fail(403,'Posto sem permissão.');
  const wrap=r=>({schema:5,revision:Number(r.revision),sessions:{[session]:r.state}});
  if(req.method==='GET'){
   const r=await query('SELECT state,revision FROM peniel_ops.ensaios_session_state WHERE session_date=$1',[session]);
   if(!r.rows[0])throw fail(503,'Ensaio ainda não preparado.');
   return res.json({db:live.project(wrap(r.rows[0]),role),role,rehearsal:true});
  }
  const {action,arg={},revision,requestId}=input;
  if(!Number.isSafeInteger(revision)||typeof requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(requestId))throw fail(400,'Comando inválido.');
  if(['scan','takeover'].includes(action))throw fail(403,'Use o leitor individual da Even3 para o ensaio.');
  if(action==='reset'&&user.role!=='geral')throw fail(403,'Somente Gestão Geral pode zerar o ensaio.');
  const hash=createHash('sha256').update(JSON.stringify({session,role,action,arg,revision})).digest('hex');
  const result=await transaction(async client=>{
   const r=await client.query('SELECT state,revision FROM peniel_ops.ensaios_session_state WHERE session_date=$1 FOR UPDATE',[session]);
   if(!r.rows[0])throw fail(503,'Ensaio não preparado.');
   const old=await client.query('SELECT payload_hash,message FROM peniel_ops.ensaios_command_log WHERE session_date=$1 AND actor_id=$2 AND request_id=$3',[session,user.user_id,requestId]);
   if(old.rows[0]){if(old.rows[0].payload_hash!==hash)throw fail(409,'Identificador reutilizado.');return {db:wrap(r.rows[0]),message:old.rows[0].message};}
   if(Number(r.rows[0].revision)!==revision)throw fail(409,'Outro colaborador atualizou o ensaio. Atualize a tela.');
   let next;
   try{
    if(action==='reset'){const state=ops.freshSession();next={db:{schema:5,revision:revision+1,sessions:{[session]:state}},message:'Somente ensaio reiniciado. Entradas e pagamentos reais preservados.'};}
    else next=live.command(wrap(r.rows[0]),session,role,action,arg);
   }catch(e){throw fail(422,e.message);}
   await client.query('UPDATE peniel_ops.ensaios_session_state SET state=$2::jsonb,revision=$3,updated_at=now() WHERE session_date=$1',[session,JSON.stringify(next.db.sessions[session]),next.db.revision]);
   await client.query('INSERT INTO peniel_ops.ensaios_command_log(session_date,actor_id,request_id,payload_hash,action,message,revision) VALUES($1,$2,$3,$4,$5,$6,$7)',[session,user.user_id,requestId,hash,action,next.message,next.db.revision]);
   return next;
  });
  return res.json({...result,db:live.project(result.db,role),rehearsal:true});
 }catch(e){if(!e.status)console.error('ensaio_command_error',{code:String(e.code||e.name||'unknown').slice(0,40)});return res.status(e.status||503).json({error:e.status?e.message:'Ensaio indisponível. Operação real não foi modificada.'});}
}