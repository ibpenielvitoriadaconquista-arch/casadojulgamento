import {createHash} from 'node:crypto';
import {query,transaction} from '../../../lib/db';
import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import ops from '../../../lib/operation-training.cjs';
import live from '../../../lib/operation-live.cjs';
import ownership from '../../../lib/group-ownership.cjs';
export const config={api:{bodyParser:{sizeLimit:'16kb'}}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(!['GET','POST'].includes(req.method))throw fail(405,'Método não permitido.');
  if(req.method==='POST')sameOrigin(req);
  const user=await actor(req),input=req.method==='GET'?req.query:req.body;
  const session=input?.session,role=input?.role;
  if(!ops.SESSIONS.some(s=>s.id===session)||!Object.hasOwn(ops.ROLES,role))throw fail(400,'Sessão ou posto inválido.');
  if(user.role!=='geral'&&role!==user.role)throw fail(403,'Este posto não pertence ao seu acesso.');
  const wrap=row=>({schema:5,revision:Number(row.revision),sessions:{[session]:row.state}});
  async function ownershipRows(client){
    const result=await client.query('SELECT group_id,coordinator_id,guide_id FROM peniel_ops.group_ownership WHERE session_date=$1',[session]);
    return Object.fromEntries(result.rows.map(row=>[row.group_id,row]));
  }
  function enrich(db,owners){
    // These are staff UUIDs, not tickets; projected fields never expose participant identities to guides.
    const s=db.sessions[session];
    s.groups=s.groups.map(group=>({...group,owner:{
      coordinatorId:owners[group.id]?.coordinator_id||null,
      guideId:owners[group.id]?.guide_id||null
    }}));
    return {db:live.project(db,role),self:user.user_id};
  }
  if(req.method==='GET'){
   const r=await query('SELECT state,revision FROM peniel_ops.session_state WHERE session_date=$1',[session]);
   if(!r.rows[0])throw fail(503,'Sessão ainda não preparada.');
   const own=await ownershipRows({query});
   return res.json({...enrich(wrap(r.rows[0]),own),role});
  }
  const {action,arg={},revision,requestId}=input;
  if(!Number.isSafeInteger(revision)||typeof requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(requestId))throw fail(400,'Comando inválido.');
  const hash=createHash('sha256').update(JSON.stringify({session,role,action,arg,revision})).digest('hex');
  const result=await transaction(async client=>{
   // Serialize every mutation of a session, including the future Even3 arrival worker.
   const r=await client.query('SELECT state,revision FROM peniel_ops.session_state WHERE session_date=$1 FOR UPDATE',[session]);
   if(!r.rows[0])throw fail(503,'Sessão não preparada.');
   const prev=await client.query('SELECT payload_hash,message FROM peniel_ops.command_log WHERE session_date=$1 AND actor_id=$2 AND request_id=$3',[session,user.user_id,requestId]);
   if(prev.rows[0]){
    if(prev.rows[0].payload_hash!==hash)throw fail(409,'Identificador de comando reutilizado.');
    return {...enrich(wrap(r.rows[0]),await ownershipRows(client)),message:prev.rows[0].message};
   }
   if(Number(r.rows[0].revision)!==revision)throw fail(409,'Outro colaborador atualizou a sessão. Atualize e confira a seleção antes de repetir.');
   // Serialize ownership and people/group changes under the session lock.
   const group=s=>r.rows[0].state.groups.some(g=>g.id===s);
   const owners=await ownershipRows(client);
   if(['claim_coordinator','claim_guide','release_coordinator','release_guide'].includes(action)){
     const id=String(arg.group||'');
     if(!group(id))throw fail(400,'Grupo inválido.');
     const coord=action.endsWith('coordinator');
     const field=coord?'coordinator_id':'guide_id';
     const slot=coord?'coordinator':'guide';
     if(action.startsWith('claim') && user.role!== (coord?'coordenacao':'guias') && user.role!=='geral')throw fail(403,'Função não autorizada.');
     if(action.startsWith('release') && user.role!=='geral')throw fail(403,'Transferência exige Gestão Geral.');
     // A guide can claim only after a group was called; the coordinator can claim a forming group.
     const stateGroup=r.rows[0].state.groups.find(g=>g.id===id);
     if(action.startsWith('claim') && (coord ? !['forming','closed'].includes(stateGroup.status) : !['called','waiting'].includes(stateGroup.status)))
       throw fail(409,'Esse grupo não está disponível para assumir agora.');
     const prior=owners[id]?.[field]||null;
     if(action.startsWith('claim')&&prior&&prior!==user.user_id)throw fail(409,'Grupo já pertence a outro colaborador.');
     if(action.startsWith('release')&&!prior)throw fail(409,'Grupo sem responsável.');
     const target=action.startsWith('release')?null:user.user_id;
     const reason=action.startsWith('release')?String(arg.reason||'').trim():'Assumiu o grupo';
     if(!reason||reason.length>300)throw fail(400,'Informe o motivo da transferência.');
     await client.query('INSERT INTO peniel_ops.group_ownership(session_date,group_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[session,id]);
     await client.query('UPDATE peniel_ops.group_ownership SET '+field+'=$3,updated_at=now() WHERE session_date=$1 AND group_id=$2',[session,id,target]);
     await client.query('INSERT INTO peniel_ops.group_ownership_audit(session_date,group_id,slot,before_user,after_user,changed_by,reason) VALUES($1,$2,$3,$4,$5,$6,$7)',
       [session,id,slot,prior,target,user.user_id,reason]);
     // Ownership changes increment revision; parallel stale clients must refresh.
     const nextRevision=Number(r.rows[0].revision)+1;
     await client.query('UPDATE peniel_ops.session_state SET revision=$2,updated_at=now() WHERE session_date=$1',[session,nextRevision]);
     const refreshed=await ownershipRows(client);
     return {...enrich({schema:5,revision:nextRevision,sessions:{[session]:r.rows[0].state}},refreshed),
       message:action.startsWith('claim')?'Grupo '+id+' assumido por este colaborador.':'Responsabilidade liberada pela Gestão Geral.'};
   }
   const affected=ownership.affected(action,arg,r.rows[0].state);
   if(ownership.slot(action)&&(!affected.length||!affected.every(group)))
     throw fail(400,'Ação sem grupos válidos.');
   if(!ownership.permitted(user.role,user.user_id,action,affected,owners))
     throw fail(403,'Este grupo pertence a outro colaborador. Peça transferência à Gestão Geral.');
   let next;
   try{next=live.command(wrap(r.rows[0]),session,role,action,arg);}catch(e){throw fail(422,e.message);}
   await client.query('UPDATE peniel_ops.session_state SET state=$2::jsonb,revision=$3,updated_at=now() WHERE session_date=$1',[session,JSON.stringify(next.db.sessions[session]),next.db.revision]);
   await client.query('INSERT INTO peniel_ops.command_log(session_date,actor_id,request_id,payload_hash,action,message,revision) VALUES($1,$2,$3,$4,$5,$6,$7)',[session,user.user_id,requestId,hash,action,next.message,next.db.revision]);
   return {...enrich(next.db,owners),message:next.message};
  });
  return res.json(result);
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Conexão indisponível. Nenhuma confirmação foi recebida; atualize antes de repetir.'});}
}
