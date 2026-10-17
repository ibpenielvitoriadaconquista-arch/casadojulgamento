import { allowMethod,noStore } from '../../lib/api';
export default function handler(req,res){
 noStore(res);if(!allowMethod(req,res,'GET'))return;
 res.status(200).json({application:'Casa do Julgamento',environment:'preview',paymentsEnabled:false,operationalAccessEnabled:false,note:'Health checks de DB e gateway exigem homologação autenticada, não são disponibilizados publicamente.'});
}
