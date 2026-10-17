import crypto from "node:crypto";
import { query } from "./db";
import security from "./security.cjs";
const { parseCookie, sameOrigin, cookieHeader } = security;
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
export function readOrderSecret(req){return parseCookie(req.headers.cookie,"cj_order_access");}
export function attachOrderCookie(res,secret){res.setHeader("Set-Cookie",cookieHeader("cj_order_access",secret,86400));}
export function noStore(res){res.setHeader("Cache-Control","no-store, private");res.setHeader("X-Robots-Tag","noindex, nofollow");}
export function safeError(res,error){
  // Nunca logar CPF/WhatsApp, tokens, secrets ou stack em respostas públicas.
  const status=error.statusCode||500;
  res.status(status).json({erro:status<500?error.message:"Não foi possível processar. Tente novamente."});
}
// Contenção adicional de tráfego no DB; WAF/rate limit de borda ainda é necessário.
export async function rateLimit(req, max=6){
  if(!process.env.RATE_LIMIT_HMAC_KEY) throw Object.assign(new Error("RATE_LIMIT_HMAC_KEY obrigatório"),{statusCode:503});
  const ip=String(req.headers["x-real-ip"]||req.socket?.remoteAddress||"unknown").slice(0,100);
  const digest=crypto.createHmac("sha256",process.env.RATE_LIMIT_HMAC_KEY).update(ip).digest("hex");
  const r=await query(`INSERT INTO rate_limits(chave,janela,tentativas)
   VALUES($1,date_trunc('minute',now()),1)
   ON CONFLICT(chave,janela) DO UPDATE SET tentativas=rate_limits.tentativas+1 RETURNING tentativas`,[digest]);
  if(r.rows[0].tentativas>max)throw Object.assign(new Error("Muitas tentativas. Aguarde um minuto."),{statusCode:429});
}
