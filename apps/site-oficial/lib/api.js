import security from "./security.cjs";
const {sameOrigin}=security;
export function allowMethod(req,res,method){
  if(req.method===method)return true;
  res.setHeader("Allow",method);res.status(405).json({erro:"Método não permitido"});return false;
}
export function requireOrigin(req,res){
  if(sameOrigin(req)) return true;
  res.status(403).json({erro:"Origem não permitida"});return false;
}
export function requireJson(req,res){
  if((req.headers['content-type']||'').split(';')[0].trim()==='application/json')return true;
  res.status(415).json({erro:"Use application/json"});return false;
}
export function noStore(res){res.setHeader("Cache-Control","no-store, private");res.setHeader("X-Robots-Tag","noindex, nofollow");}
export function safeError(res,error){
  // Nunca logar CPF/WhatsApp, tokens, secrets ou stack em respostas públicas.
  const status=error.statusCode||500;
  res.status(status).json({erro:status<500?error.message:"Não foi possível processar. Tente novamente."});
}
