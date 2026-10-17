import { allowMethod, noStore, safeError } from '../../lib/api';
import { listSessions } from '../../lib/orders';
import rules from '../../lib/rules.cjs';
const { SESSIONS } = rules;
export default async function handler(req,res){
 noStore(res);if(!allowMethod(req,res,'GET'))return;
 // Preview sem banco, estoque inventado ou coleta de dados pessoais.
 // Não usar NEXT_PUBLIC_* como habilitador de compra; gate exclusivamente no servidor.
 if(process.env.PRODUCTION_RELEASE_APPROVED!=='true'){
   return res.status(200).json(SESSIONS.map(s=>({...s,vagasOnlineRestantes:null,vendaDisponivel:false})));
 }
 try{
   const availability=await listSessions();
   res.status(200).json(availability.map(x=>({...SESSIONS.find(s=>s.id===x.id),...x,vendaDisponivel:true})));
 }catch(e){safeError(res,e)}
}
