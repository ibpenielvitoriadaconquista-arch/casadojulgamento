import {demoRole,checkDemo,demoCookie,demoSetCookie} from '../../../lib/demo-auth';
import {fail,sameOrigin} from '../../../lib/operation-auth';
export const config={api:{bodyParser:{sizeLimit:'2kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(req.method!=='POST')throw fail(405,'Método inválido.');
  sameOrigin(req);
  const email=String(req.body?.email||'').toLowerCase().trim(),password=req.body?.password;
  if(!email||typeof password!=='string'||password.length>128)throw fail(400,'Informe os dados de demonstração.');
  if(!checkDemo(email,password))throw fail(401,'Acesso demonstrativo não reconhecido.');
  const role=demoRole(email);
  res.setHeader('Set-Cookie',demoSetCookie(demoCookie(email)));
  return res.json({ok:true,role,demo:true});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Demonstração indisponível.'});}
}