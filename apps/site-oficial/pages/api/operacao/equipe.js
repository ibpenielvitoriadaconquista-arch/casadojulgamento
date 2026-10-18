import {query,transaction} from '../../../lib/db';
import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import {authClient,throttle} from '../../../lib/staff-access';
import ops from '../../../lib/operation-training.cjs';
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(!['GET','POST'].includes(req.method))throw fail(405,'Método não permitido.');
  if(req.method==='POST')sameOrigin(req);
  const user=await actor(req);if(user.role!=='geral')throw fail(403,'Apenas a gestão geral administra colaboradores.');
  if(req.method==='GET'){const r=await query('SELECT s.user_id,s.role,s.active,u.email,u.email_confirmed_at FROM peniel_ops.staff s JOIN auth.users u ON u.id=s.user_id ORDER BY u.email');return res.json({staff:r.rows,self:user.user_id});}
  await throttle(req,'staff',user.user_id);
  const {action,userId,role,active}=req.body||{};
  if(action==='update'){
   if(!Object.hasOwn(ops.ROLES,role)||typeof active!=='boolean'||typeof userId!=='string')throw fail(400,'Informe função e situação válidas.');
   if(userId===user.user_id)throw fail(400,'Sua própria função deve ser alterada por outro administrador.');
   await transaction(async c=>{
    await c.query("SELECT pg_advisory_xact_lock(hashtext('peniel-staff-management'))");
    const manager=await c.query("SELECT user_id FROM peniel_ops.staff WHERE user_id=$1 AND active=true AND role='geral'",[user.user_id]);if(!manager.rows.length)throw fail(403,'Seu acesso de gestão foi alterado.');
    const current=await c.query('SELECT role,active FROM peniel_ops.staff WHERE user_id=$1 FOR UPDATE',[userId]);if(!current.rows[0])throw fail(404,'Colaborador não encontrado.');
    await c.query('UPDATE peniel_ops.staff SET role=$2,active=$3 WHERE user_id=$1',[userId,role,active]);
    await c.query('INSERT INTO peniel_ops.staff_audit(actor_id,target_id,action,details) VALUES($1,$2,$3,$4::jsonb)',[user.user_id,userId,'update',JSON.stringify({before:current.rows[0],after:{role,active}})]);
   });return res.json({ok:true});
  }
  if(!['invite','recovery'].includes(action))throw fail(400,'Comando inválido.');
  const email=String(req.body.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw fail(400,'Informe um e-mail válido.');
  const found=await query('SELECT u.id,s.role,s.active FROM auth.users u LEFT JOIN peniel_ops.staff s ON s.user_id=u.id WHERE lower(u.email)=$1',[email]);
  if(action==='invite'&&(found.rows.length||!Object.hasOwn(ops.ROLES,role)))throw fail(400,'Conta já cadastrada ou função inválida. Use a recuperação para contas existentes.');
  if(action==='recovery'&&!found.rows[0]?.active)throw fail(400,'Recuperação disponível apenas para colaboradores ativos.');
  const {data,error}=await authClient(true).auth.admin.generateLink({type:action==='invite'?'invite':'recovery',email});
  if(error||!data?.user?.id||!data?.properties?.hashed_token)throw fail(503,'Não foi possível gerar o convite. Confira a configuração de autenticação.');
  await transaction(async c=>{
   const manager=await c.query("SELECT user_id FROM peniel_ops.staff WHERE user_id=$1 AND active=true AND role='geral' FOR UPDATE",[user.user_id]);if(!manager.rows.length)throw fail(403,'Seu acesso de gestão foi alterado.');
   if(action==='invite')await c.query('INSERT INTO peniel_ops.staff(user_id,role,active) VALUES($1,$2,true)',[data.user.id,role]);
   await c.query('INSERT INTO peniel_ops.staff_audit(actor_id,target_id,action,details) VALUES($1,$2,$3,$4::jsonb)',[user.user_id,data.user.id,action,JSON.stringify({role:action==='invite'?role:found.rows[0].role})]);
  });
  // Fragment is not sent in HTTP requests or referrer headers. No email is sent by generateLink.
  const link=req.headers.origin+'/operacao/ativar#token_hash='+encodeURIComponent(data.properties.hashed_token)+'&type='+(action==='invite'?'invite':'recovery');
  return res.json({link});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível concluir. Atualize a lista antes de repetir.'});}
}
