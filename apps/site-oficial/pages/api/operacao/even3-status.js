import {actor,fail} from '../../../lib/operation-auth';
import {query} from '../../../lib/db';
import even3 from '../../../lib/even3-client.cjs';
import rules from '../../../lib/official-entries.cjs';
import financial from '../../../lib/even3-financial.cjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 try{
  if(req.method!=='GET')throw fail(405,'Método não permitido.');const user=await actor(req);if(user.role!=='geral')throw fail(403,'Somente Gestão Geral.');
  const event=await even3.event();
  const counts=await query('SELECT status,count(*)::int AS total FROM peniel_ops.entry_checkins GROUP BY status');
  const financialProbe=req.query.finance==='1'?await financial.diagnostic(even3):undefined;
  return res.json({apiCredentialConfigured:!!process.env.EVEN3_API_TOKEN,eventVerified:true,entries:rules.ENTRIES.map(e=>({label:e.label,id:e.entryId,verified:rules.catalogMatches(event,e)})),checkins:counts.rows,liveAdmissionEnabled:true,automaticCheckinEnabled:true,financialVerificationRequired:true,financialProbe});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível verificar a integração.'});}
}
