import {randomUUID} from 'node:crypto';
import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import {query,transaction} from '../../../lib/db';
import {throttle} from '../../../lib/staff-access';
import assistant from '../../../lib/operations-assistant.cjs';
import admission from '../../../lib/official-admission.cjs';
import training from '../../../lib/training-tickets.cjs';
import even3 from '../../../lib/even3-client.cjs';
import confirmation from '../../../lib/assistant-confirmation.cjs';
export const config={api:{bodyParser:{sizeLimit:'5kb'}},maxDuration:180};
const tools=assistant.createTools({query,admission:admission.createService({query,transaction,even3}),trainingService:training.createService({query,transaction}),even3});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');let leased;
 try{
  const user=await actor(req,res);assistant.requireManager(user);
  if(req.method==='GET'){
   const threads=(await query('SELECT id,created_at,updated_at FROM peniel_ops.assistant_threads WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 10',[user.user_id])).rows;
   const id=req.query.threadId;let messages=[],proposals=[];
   if(id){if(!uuid(id)||!(await query('SELECT id FROM peniel_ops.assistant_threads WHERE id=$1 AND owner_id=$2',[id,user.user_id])).rows.length)throw fail(404,'Conversa não encontrada.');
    messages=(await query('SELECT role,content,metadata,created_at FROM (SELECT * FROM peniel_ops.assistant_messages WHERE thread_id=$1 ORDER BY id DESC LIMIT 30) m ORDER BY id',[id])).rows;
    proposals=(await query("SELECT payload,status FROM peniel_ops.assistant_proposals WHERE thread_id=$1 AND owner_id=$2 AND status='pending' AND expires_at>now()",[id,user.user_id])).rows.map(r=>r.payload);
   }
   return res.json({configured:!!(process.env.OPENAI_API_KEY&&process.env.OPENAI_MODEL),threads,messages,proposals});
  }
  if(req.method!=='POST')throw fail(405,'Método não permitido.');sameOrigin(req);
  await throttle(req,'operations_assistant',user.user_id);
  const b=req.body||{};
  if(b.action==='new'){const id=randomUUID();await query('INSERT INTO peniel_ops.assistant_threads(id,owner_id) VALUES($1,$2)',[id,user.user_id]);return res.json({id});}
  if(b.action==='tool'){
   if(!assistant.readTools.includes(b.name))throw fail(400,'Consulta não permitida.');
   return res.json(await tools.run(b.name,b.args,{user,session:assistant.chooseSession(b.session),proposals:[]}));
  }
  if(b.action==='confirm'){
   if(!uuid(b.proposalId)||b.confirmed!==true||!['paid','exempt'].includes(b.paymentStatus)||typeof b.evidence!=='string'||b.evidence.trim().length<10||b.evidence.length>500)throw fail(400,'Confirme a conferência e informe a evidência (10–500 caracteres).');
   const result=await confirmation.confirm({query,user,proposalId:b.proposalId,paymentStatus:b.paymentStatus,evidence:b.evidence,token:req.cookies.peniel_session});
   return res.status(result.status==='authorized'?200:409).json(result);
  }
  if(b.action!=='chat')throw fail(400,'Ação inválida.');
  const message=assistant.validMessage(b.message),session=assistant.chooseSession(b.session);
  const command=confirmation.parse(message);
  if(!command&&(!process.env.OPENAI_API_KEY||!process.env.OPENAI_MODEL))throw fail(503,'Chat preparado. Falta configurar a API OpenAI no servidor. Consultas rápidas e manual estão disponíveis.');
  if(!uuid(b.threadId))throw fail(400,'Abra uma conversa.');
  const lock=await query("UPDATE peniel_ops.assistant_threads SET busy_until=now()+interval '3 minutes',updated_at=now() WHERE id=$1 AND owner_id=$2 AND (busy_until IS NULL OR busy_until<now()) RETURNING id",[b.threadId,user.user_id]);
  if(!lock.rows.length)throw fail(409,'Conversa indisponível ou processando outra mensagem.');leased=b.threadId;
  const history=(await query('SELECT role,content,metadata FROM (SELECT id,role,content,metadata FROM peniel_ops.assistant_messages WHERE thread_id=$1 ORDER BY id DESC LIMIT 12) m ORDER BY id',[leased])).rows;
  await query("INSERT INTO peniel_ops.assistant_messages(thread_id,role,content) VALUES($1,'user',$2)",[leased,message]);
  if(command){
   const proposalId=await confirmation.findProposal({query,user,threadId:leased,session,command});
   const result=await confirmation.confirm({query,user,proposalId,paymentStatus:command.paymentStatus,evidence:command.evidence,token:req.cookies.peniel_session});
   await query("INSERT INTO peniel_ops.assistant_messages(thread_id,role,content,metadata) VALUES($1,'assistant',$2,$3::jsonb)",[leased,result.message,JSON.stringify({source:'server_authorization',status:result.status,proposalId})]);
   return res.json({text:result.message,status:result.status,proposals:[],sources:[{tool:'server_authorization',queriedAt:new Date().toISOString()}]});
  }
  const answer=await assistant.chat({message,history,session,user,threadId:leased,tools,apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL});
  await query("INSERT INTO peniel_ops.assistant_messages(thread_id,role,content,metadata) VALUES($1,'assistant',$2,$3::jsonb)",[leased,answer.text,JSON.stringify({sources:answer.sources,model:answer.model,usage:answer.usage})]);
  return res.json(answer);
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Consulta temporariamente indisponível. Use os painéis operacionais.'});}
 finally{if(leased)await query('UPDATE peniel_ops.assistant_threads SET busy_until=null WHERE id=$1',[leased]).catch(()=>{});}
}
