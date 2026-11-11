import {actor,fail} from '../../../lib/operation-auth';
import {query} from '../../../lib/db';
import even3 from '../../../lib/even3-client.cjs';
import stock from '../../../lib/sales-stock.cjs';
const service=stock.createService({query,even3});
export const config={maxDuration:30};
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 try{if(req.method!=='GET')throw fail(405,'Método não permitido.');const user=await actor(req,res);if(!['geral','caixa','coordenacao'].includes(user.role))throw fail(403,'Consulta restrita ao Caixa, Coordenação e Gestão.');return res.json(await service.read(req.query.session));}
 catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível atualizar o saldo. Não distribua novas senhas sem conferir a Even3.'});}
}
