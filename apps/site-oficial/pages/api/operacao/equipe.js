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
  if(action==='deactivate'){
   if(typeof userId!=='string'||userId===user.user_id)throw fail(400,'Não é permitido desativar sua própria conta.');
   await transaction(async c=>{
    await c.query("SELECT pg_advisory_xact_lock(hashtext('peniel-staff-management'))");
    const manager=await c.query("SELECT 1 FROM peniel_ops.staff WHERE user_id=$1 AND role='geral' AND active=true",[user.user_id]);
    if(!manager.rowCount)throw fail(403,'Permissão administrativa revogada.');
    const existing=await c.query('SELECT role,active FROM peniel_ops.staff WHERE user_id=$1 FOR UPDATE',[userId]);
    if(!existing.rowCount)throw fail(404,'Colaborador não encontrado.');
    await c.query('UPDATE peniel_ops.staff SET active=false WHERE user_id=$1',[userId]);
    await c.query("INSERT INTO peniel_ops.staff_audit(actor_id,target_id,action,details) VALUES($1,$2,'deactivate',$3::jsonb)",[user.user_id,userId,JSON.stringify({before:existing.rows[0]})]);
   });
   return res.json({ok:true,message:'Acesso desativado. Cadastro e histórico preservados para auditoria.'});
  }
  if(!['invite','recovery'].includes(action))throw fail(400,'Comando inválido.');
  const email=String(req.body.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw fail(400,'Informe um e-mail válido.');
  const found=await query('SELECT u.id,s.role,s.active FROM auth.users u LEFT JOIN peniel_ops.staff s ON s.user_id=u.id WHERE lower(u.email)=$1',[email]);
  if(action==='invite'&&(found.rows.length||!Object.hasOwn(ops.ROLES,role)))throw fail(400,'Conta já cadastrada ou função inválida. Use a recuperação para contas existentes.');
  if(action==='recovery'&&!found.rows[0]?.active)throw fail(400,'Recuperação disponível apenas para colaboradores ativos.');
  const admin=authClient(true);
  if(action==='invite'){
    // Supabase Auth sends the email; it must have a working SMTP provider.
    const redirectTo='https://www.ibpeniel.com/operacao/ativar';
    const {data,error}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo});
    if(error||!data?.user?.id)throw fail(503,'Falha ao solicitar envio do convite. Confira SMTP e os limites de e-mail do Supabase.');
    await transaction(async client=>{
      const manager=await client.query("SELECT user_id FROM peniel_ops.staff WHERE user_id=$1 AND role='geral' AND active=true FOR UPDATE",[user.user_id]);
      if(!manager.rows.length)throw fail(403,'Permissão de gestão revogada.');
      await client.query('INSERT INTO peniel_ops.staff(user_id,role,active) VALUES($1,$2,true) ON CONFLICT(user_id) DO NOTHING',[data.user.id,role]);
      await client.query('INSERT INTO peniel_ops.staff_audit(actor_id,target_id,action,details) VALUES($1,$2,$3,$4::jsonb)',[user.user_id,data.user.id,'invite_email_requested',JSON.stringify({role})]);
    });
    return res.json({ok:true,emailSent:true,message:'Envio de convite solicitado ao Supabase. Verifique a caixa de entrada e a configuração SMTP.'});
  }
  const redirectTo='https://www.ibpeniel.com/operacao/ativar';
  const {error}=await authClient().auth.resetPasswordForEmail(email,{redirectTo});
  if(error)throw fail(503,'Não foi possível solicitar e-mail de redefinição. Verifique SMTP.');
  await query('INSERT INTO peniel_ops.staff_audit(actor_id,target_id,action,details) VALUES($1,$2,$3,$4::jsonb)',[user.user_id,found.rows[0].id,'recovery_email_requested',JSON.stringify({role:found.rows[0].role})]);
  return res.json({ok:true,emailSent:true,message:'E-mail de redefinição solicitado. Confira a caixa de entrada.'});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível concluir. Atualize a lista antes de repetir.'});}
}
