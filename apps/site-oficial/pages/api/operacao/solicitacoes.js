import {query,transaction} from '../../../lib/db';
import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import {authClient,throttle} from '../../../lib/staff-access';
import ops from '../../../lib/operation-training.cjs';
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
const PUBLIC_ROLES=new Set(['guias','coordenacao','caixa','apoio','portaria']);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(!['GET','POST'].includes(req.method))throw fail(405,'Método não permitido.');
  if(req.method==='POST')sameOrigin(req);
  const user=await actor(req);
  if(user.role!=='geral')throw fail(403,'Apenas gestão geral pode analisar solicitações.');
  if(req.method==='GET'){
   const result=await query('SELECT id,full_name,email,whatsapp,requested_role,status,created_at FROM peniel_ops.access_requests ORDER BY (status=\'pending\') DESC,created_at ASC LIMIT 250');
   return res.json({requests:result.rows});
  }
  const id=String(req.body?.id||'');
  const action=req.body?.action;
  if(!/^[0-9a-f-]{36}$/i.test(id)||!['approve','reject'].includes(action))throw fail(400,'Solicitação inválida.');
  await throttle(req,'requests_review',user.user_id);
  const request=await query("SELECT * FROM peniel_ops.access_requests WHERE id=$1 AND status='pending'",[id]);
  const item=request.rows[0];if(!item)throw fail(409,'Solicitação não encontrada ou já analisada.');
  if(!PUBLIC_ROLES.has(item.requested_role)||!Object.hasOwn(ops.ROLES,item.requested_role))throw fail(422,'Função não permitida.');
  if(action==='reject'){
   const result=await query("UPDATE peniel_ops.access_requests SET status='rejected',reviewed_by=$2,reviewed_at=now() WHERE id=$1 AND status='pending' RETURNING id",[id,user.user_id]);
   if(!result.rowCount)throw fail(409,'Solicitação já analisada.');
   return res.json({ok:true});
  }
  const existing=await query('SELECT u.id,s.role,s.active FROM auth.users u LEFT JOIN peniel_ops.staff s ON s.user_id=u.id WHERE lower(u.email)=$1',[item.email]);
  if(existing.rows[0]?.active)throw fail(409,'Esta conta já é colaboradora. Use Gestão de Equipe.');
  // Send official invite/recovery e-mail via Supabase Auth, never expose an OTP in the response.
  const linkType=existing.rows.length?'recovery':'invite';
  let id=existing.rows[0]?.id;
  if(linkType==='invite'){
    const {data,error}=await authClient(true).auth.admin.inviteUserByEmail(item.email,{redirectTo:'https://www.ibpeniel.com/operacao/ativar'});
    if(error||!data?.user?.id)throw fail(503,'Falha ao solicitar e-mail de convite. Verifique SMTP do Supabase.');
    id=data.user.id;
  }else{
    const {error}=await authClient().auth.resetPasswordForEmail(item.email,{redirectTo:'https://www.ibpeniel.com/operacao/ativar'});
    if(error)throw fail(503,'Falha ao solicitar e-mail de recuperação.');
  }
  const data={user:{id}};
  await transaction(async c=>{
   const lock=await c.query("SELECT id FROM peniel_ops.access_requests WHERE id=$1 AND status='pending' FOR UPDATE",[id]);
   if(!lock.rowCount)throw fail(409,'Solicitação já analisada.');
   const manager=await c.query("SELECT 1 FROM peniel_ops.staff WHERE user_id=$1 AND role='geral' AND active=true",[user.user_id]);
   if(!manager.rowCount)throw fail(403,'Permissão de gestão revogada.');
   await c.query(`INSERT INTO peniel_ops.staff(user_id,role,active,full_name,whatsapp)
     VALUES($1,$2,true,$3,$4)
     ON CONFLICT(user_id) DO UPDATE SET
     role=EXCLUDED.role,active=true,full_name=EXCLUDED.full_name,whatsapp=EXCLUDED.whatsapp`,
     [data.user.id,item.requested_role,item.full_name,item.whatsapp]);
   await c.query("UPDATE peniel_ops.access_requests SET status='approved',reviewed_by=$2,reviewed_at=now() WHERE id=$1",[id,user.user_id]);
   await c.query('INSERT INTO peniel_ops.staff_audit(actor_id,target_id,action,details) VALUES($1,$2,$3,$4::jsonb)',
    [user.user_id,data.user.id,'approve_application',JSON.stringify({requestId:id,role:item.requested_role})]);
  });
  return res.json({ok:true,emailSent:true,message:'Solicitação aprovada. Envio do e-mail de acesso solicitado ao Supabase.'});
 }catch(e){
  if(!e.status)console.error('peniel_approval_error',{code:String(e?.code||e?.name||'unknown').slice(0,40)});
  return res.status(e.status||503).json({error:e.status?e.message:'Falha ao processar solicitação; tente novamente.'});
 }
}
