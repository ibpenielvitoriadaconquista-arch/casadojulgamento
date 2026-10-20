import rules from '../../lib/rules.cjs';
import {salesReleaseEnabled} from '../../lib/release-gate.cjs';

export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'});}
 const salesEnabled=salesReleaseEnabled();
 // This is a release flag, not live inventory. Available stock remains authoritative in Even3.
 return res.json(rules.SESSIONS.map(s=>({...s,vagasOnlineRestantes:null,vendaDisponivel:salesEnabled,checkoutProvider:'even3'})));
}
