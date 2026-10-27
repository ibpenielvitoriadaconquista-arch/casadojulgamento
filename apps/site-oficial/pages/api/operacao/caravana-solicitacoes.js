import {randomUUID} from 'node:crypto';
import {query,transaction} from '../../../lib/db';
import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import live from '../../../lib/operation-live.cjs';
import requests from '../../../lib/caravan-requests.cjs';
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 try{
  const user=await actor(req);if(!['geral','coordenacao'].includes(user.role))throw fail(403,'Acesso restrito à Gestão e Coordenação.');
  if(req.method==='GET'){
   const rows=await query("SELECT id,session_date,payload,created_at FROM peniel_ops.caravan_requests WHERE status='pending' ORDER BY created_at LIMIT 200");
   return res.json({requests:rows.rows});
  }
  if(req.method!=='POST')throw fail(405,'Método não permitido.');sameOrigin(req);
  if(user.role!=='geral')throw fail(403,'Somente Gestão pode confirmar o recebimento e importar.');
  const {id,group,method,reference,confirmed}=req.body||{};
  if(!Number.isSafeInteger(Number(id))||!['G06','G07','G08'].includes(group)||!['dinheiro','pix_igreja','cortesia'].includes(method)||confirmed!==true||String(reference||'').trim().length<10||String(reference).length>200)throw fail(400,'Confira grupo, recebimento, referência e confirmação.');
  const result=await transaction(async db=>{
   const row=(await db.query('SELECT * FROM peniel_ops.caravan_requests WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!row||row.status!=='pending')throw fail(409,'Solicitação já analisada ou indisponível.');
   const data=requests.input(row.payload),session=data.session;
   const current=(await db.query('SELECT state,revision FROM peniel_ops.session_state WHERE session_date=$1 FOR UPDATE',[session])).rows[0];if(!current)throw fail(503,'Sessão indisponível.');
   const caravanId=randomUUID(),members=data.members.map(m=>({...m,code:'CAR-'+randomUUID()}));
   let dbState={schema:5,revision:Number(current.revision),sessions:{[session]:current.state}};
   try{
    dbState=live.command(dbState,session,'geral','caravanSave',{...data,id:caravanId,group,members,actorId:user.user_id}).db;
    dbState=live.command(dbState,session,'geral','caravanAuthorize',{id:caravanId,method,reference:String(reference).trim(),actorId:user.user_id}).db;
   }catch(e){throw fail(409,e.message);}
   await db.query('UPDATE peniel_ops.session_state SET state=$2::jsonb,revision=$3,updated_at=now() WHERE session_date=$1',[session,JSON.stringify(dbState.sessions[session]),dbState.revision]);
   await db.query("UPDATE peniel_ops.caravan_requests SET status='imported',reviewed_at=now(),reviewed_by=$2,caravan_id=$3,review_reference=$4 WHERE id=$1",[id,user.user_id,caravanId,String(reference).trim()]);
   return {message:'Caravana importada e autorizada. Cada integrante ainda precisa passar pela Portaria.'};
  });return res.json(result);
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível concluir a solicitação.'});}
}
