import {query} from '../../lib/db';
import {fail,sameOrigin} from '../../lib/operation-auth';
import {throttle} from '../../lib/staff-access';
import requests from '../../lib/caravan-requests.cjs';
export const config={api:{bodyParser:{sizeLimit:'16kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(req.method!=='POST')throw fail(405,'Método não permitido.');sameOrigin(req);
  let data;try{data=requests.input(req.body);}catch(e){throw fail(400,e.message);}
  const requestId=String(req.body?.requestId||'');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))throw fail(400,'Solicitação inválida. Atualize a página.');
  await throttle(req,'public_caravan_request');
  const saved=await query('INSERT INTO peniel_ops.caravan_requests(session_date,payload,request_id) VALUES($1,$2::jsonb,$3) ON CONFLICT(request_id) DO UPDATE SET request_id=EXCLUDED.request_id WHERE peniel_ops.caravan_requests.payload=EXCLUDED.payload RETURNING id',[data.session,JSON.stringify(data),requestId]);
  if(!saved.rows.length)throw fail(409,'Os dados mudaram após o primeiro envio. Entre em contato com a equipe antes de enviar novamente.');
  return res.status(202).json({ok:true,message:'Solicitação enviada. A equipe entrará em contato para conferir vagas e pagamento. Isto ainda não é uma reserva.'});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível enviar agora. Tente novamente.'});}
}
