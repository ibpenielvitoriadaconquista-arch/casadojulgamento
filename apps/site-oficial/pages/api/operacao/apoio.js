import {createHash} from 'node:crypto';
import {query,transaction} from '../../../lib/db';
import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import timer from '../../../lib/rehearsal.cjs';
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(!['GET','POST'].includes(req.method))throw fail(405,'Método não permitido.');
  if(req.method==='POST')sameOrigin(req);
  const user=await actor(req);if(!['apoio','geral','guias','coordenacao'].includes(user.role))throw fail(403,'Posto sem acesso aos tempos.');
  const input=req.method==='GET'?req.query:req.body,station=Number(input.station);
  if(!Number.isInteger(station)||station<1||station>6)throw fail(400,'Posto inválido.');
  if(req.method==='GET'){const r=await query('SELECT state FROM peniel_ops.rehearsal WHERE station=$1',[station]);if(!r.rows[0])throw fail(503,'Cronômetro não preparado.');return res.json({state:r.rows[0].state,serverNow:Date.now(),actor:user});}
  if(!['apoio','geral'].includes(user.role))throw fail(403,'Este perfil pode apenas acompanhar.');
  const {requestId,revision,action,arg={}}=input;
  if(typeof requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(requestId)||!Number.isSafeInteger(revision))throw fail(400,'Comando inválido.');
  const hash=createHash('sha256').update(JSON.stringify({station,revision,action,arg})).digest('hex');
  const state=await transaction(async c=>{
   const r=await c.query('SELECT state FROM peniel_ops.rehearsal WHERE station=$1 FOR UPDATE',[station]);if(!r.rows[0])throw fail(503,'Posto não preparado.');
   const old=await c.query('SELECT payload_hash FROM peniel_ops.rehearsal_commands WHERE actor_id=$1 AND request_id=$2',[user.user_id,requestId]);
   if(old.rows[0]){if(old.rows[0].payload_hash!==hash)throw fail(409,'Comando reutilizado.');return r.rows[0].state;}
   if(r.rows[0].state.revision!==revision)throw fail(409,'O cronômetro mudou. Confira a atualização antes de repetir.');
   let next;try{next=timer.apply(r.rows[0].state,action,arg,user);}catch(e){throw fail(422,e.message);}
   await c.query('UPDATE peniel_ops.rehearsal SET state=$2::jsonb,updated_at=now() WHERE station=$1',[station,JSON.stringify(next)]);
   await c.query('INSERT INTO peniel_ops.rehearsal_commands(actor_id,request_id,payload_hash,station,action) VALUES($1,$2,$3,$4,$5)',[user.user_id,requestId,hash,station,action]);return next;
  });return res.json({state,serverNow:Date.now(),actor:user});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Sem conexão. Confira a atualização antes de repetir.'});}
}
