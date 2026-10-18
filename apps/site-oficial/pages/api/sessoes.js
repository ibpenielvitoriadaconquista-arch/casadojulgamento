import rules from '../../lib/rules.cjs';
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'});}
 // Schedule only. Local stock and payments are not connected to Even3.
 return res.json(rules.SESSIONS.map(s=>({...s,vagasOnlineRestantes:null,vendaDisponivel:false,checkoutProvider:'even3'})));
}
