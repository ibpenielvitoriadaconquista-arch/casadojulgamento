import {actor} from '../../../lib/operation-auth';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 try{await actor(req);return res.status(410).json({error:'O painel antigo de tempos foi desativado. Atualize a página e abra /operacao/apoio para acompanhar os grupos.'});}
 catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível verificar seu acesso.'});}
}
