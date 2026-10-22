import {actor,fail} from '../../../lib/operation-auth';
import {query} from '../../../lib/db';
import tickets from '../../../lib/entry-tickets.cjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 try{
  if(req.method!=='GET')throw fail(405,'Método não permitido.');
  const user=await actor(req);
  if(user.role!=='geral')throw fail(403,'Somente Gestão Geral.');
  const token=process.env.EVEN3_API_TOKEN||'';
  const configured=!!token;
  const mapping=await query('SELECT count(*)::int AS total,count(*) FILTER (WHERE active=true AND verified_at IS NOT NULL)::int AS verified FROM even3_integration.entry_map WHERE event_id=$1',[tickets.EVENT_ID]);
  const outbox=await query('SELECT status,count(*)::int AS total FROM peniel_ops.even3_checkin_outbox WHERE event_id=$1 GROUP BY status',[tickets.EVENT_ID]);
  return res.json({apiCredentialConfigured:configured,catalog:{total:mapping.rows[0]?.total||0,verified:mapping.rows[0]?.verified||0},outbox:outbox.rows,automaticCheckinEnabled:false,liveAdmissionEnabled:process.env.CDJ_ENTRY_ADMISSION_ENABLED==='true',nextStep:!configured?'Configurar EVEN3_API_TOKEN como segredo da produção Vercel.':'Validar chave por consulta não mutante à Even3 antes de ativar o envio.'});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível verificar a integração.'});}
}
