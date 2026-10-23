import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import {query,transaction} from '../../../lib/db';
import tickets from '../../../lib/entry-tickets.cjs';
import admission from '../../../lib/official-admission.cjs';
import even3 from '../../../lib/even3-client.cjs';
import financial from '../../../lib/even3-financial.cjs';
export const config={api:{bodyParser:{sizeLimit:'3kb'}}};
const service=admission.createService({query,transaction,even3,reconcile:financial.reconcile});
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 try{
  if(req.method!=='POST')throw fail(405,'Método não permitido.');
  sameOrigin(req);const user=await actor(req);
  if(!['portaria','caixa','geral'].includes(user.role))throw fail(403,'Somente Portaria, Caixa ou Gestão Geral.');
  const {code:raw,session,action='lookup'}=req.body||{},code=tickets.parseTicketCode(raw);
  if(!code||!['lookup','admit'].includes(action))throw fail(400,'Código ou ação inválidos.');
  return res.json(await (action==='admit'?service.admit(code,session,user):service.lookup(code,session)));
 }catch(e){if(!e.status)console.error('official_entry_error',{code:String(e.code||e.name||'unknown').slice(0,60)});return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível concluir. Consulte o ingresso novamente; não libere sem confirmação.'});}
}
