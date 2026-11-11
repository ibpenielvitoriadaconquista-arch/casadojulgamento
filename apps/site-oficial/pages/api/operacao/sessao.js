import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
export const config={api:{bodyParser:{sizeLimit:'1kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 try{
  if(req.method!=='POST')throw fail(405,'Método não permitido.');
  sameOrigin(req);
  const user=await actor(req,res);
  return res.json({ok:true,role:user.role,renewable:!!req.cookies?.peniel_refresh});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Sem comunicação para renovar a sessão. Tentaremos novamente.'});}
}
