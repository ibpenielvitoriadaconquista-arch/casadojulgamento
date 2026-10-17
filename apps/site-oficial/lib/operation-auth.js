import {query} from './db';
export function fail(status,message){const e=new Error(message);e.status=status;return e;}
export function sameOrigin(req){
  const origin=req.headers.origin;
  if(!origin || new URL(origin).host!==req.headers.host)throw fail(403,'Origem não autorizada.');
}
export function authConfig(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
  if(!url||!key)throw fail(503,'Autenticação ainda não configurada.');
  return {url,key};
}
export async function actor(req){
  const token=req.cookies?.peniel_session;
  if(!token)throw fail(401,'Entre com sua conta de colaborador.');
  const {url,key}=authConfig();
  const r=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw fail(401,'Sessão expirada. Entre novamente.');
  const user=await r.json();
  const result=await query('SELECT user_id, role FROM peniel_ops.staff WHERE user_id=$1 AND active=true',[user.id]);
  if(!result.rows[0])throw fail(403,'Conta sem permissão de colaborador.');
  return result.rows[0];
}
export function cookie(token,seconds){return `peniel_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${seconds}${process.env.NODE_ENV==='production'?'; Secure':''}`;}
