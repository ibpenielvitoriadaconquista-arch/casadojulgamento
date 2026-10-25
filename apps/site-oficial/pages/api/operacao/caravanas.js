import {actor,fail} from '../../../lib/operation-auth';
import {query} from '../../../lib/db';
import caravans from '../../../lib/caravans.cjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 try{
  if(req.method!=='GET')throw fail(405,'Método não permitido.');
  const user=await actor(req);if(!['portaria','geral','caixa'].includes(user.role))throw fail(403,'Consulta restrita à Portaria, Caixa e Gestão.');
  const {session}=req.query;if(!caravans.enabled(session))throw fail(400,'Selecione uma apresentação de novembro.');
  const r=await query('SELECT state,revision FROM peniel_ops.session_state WHERE session_date=$1',[session]);
  if(!r.rows[0])throw fail(503,'Sessão não preparada.');
  return res.json({revision:Number(r.rows[0].revision),members:caravans.gateRows(r.rows[0].state,session)});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível consultar as caravanas. Nenhuma entrada foi registrada.'});}
}
