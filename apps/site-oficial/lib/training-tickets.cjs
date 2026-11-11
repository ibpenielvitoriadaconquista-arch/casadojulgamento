'use strict';
const live=require('./operation-live.cjs'),tickets=require('./entry-tickets.cjs');
const SESSION='2026-10-22',TEAM_SESSION='2026-11-11';
const allowedSession=(code,session)=>session===(/^CJ-[0-9]{3}$/.test(code)?TEAM_SESSION:SESSION);
function parse(raw){
 if(typeof raw!=='string'||raw.length>512)return null;
 const value=raw.normalize('NFKC').trim().replace(/^`|`$/g,'').replace(/[\u2010-\u2015\u2212]/g,'-').replace(/\s/g,'').toUpperCase();
 if(/^CJ-[0-9]{3}$/.test(value))return value;
 const match=/^CDJTESTE-?([0-9]{4})-?([0-9]{3})$/.exec(value);
 return match?'CDJTESTE-'+match[1]+'-'+match[2]:null;
}
const fail=(status,message)=>Object.assign(new Error(message),{status});
function inspect(state,code,session,at){
 if(!allowedSession(code,session))throw fail(403,'Ingresso fictício permitido somente na sua sessão de treinamento.');
 const ticket=(state.trainingTickets||[]).find(t=>t.code===code);
 if(!ticket)throw fail(404,'Código de treinamento não cadastrado.');
 const used=!!ticket.usedAt||state.people.some(p=>p.id===code);
 const eligible=!state.closedAt&&!used&&ticket.enabled===true&&ticket.paymentStatus==='simulated_confirmed'&&ticket.day===tickets.bahiaDay(new Date(at));
 return {ticket,used,eligible};
}
function response(state,code,session,at,admitted=false){
 const {ticket,used,eligible}=inspect(state,code,session,at);
 return {found:true,training:true,participantName:ticket.name,entry:{id:'training-native',date:session,label:session===TEAM_SESSION?'11/11 · TREINAMENTO · INGRESSO FICTÍCIO':'Lote 1 · INGRESSO FICTÍCIO'},session,admitted,eligible,checkedIn:used,status:admitted?'admitted':eligible?'ready':'blocked',message:admitted?'TESTE: entrada registrada e pessoa enviada à Coordenação. Nenhum credenciamento Even3.':used?'Código de treinamento já utilizado. Não registre outra entrada.':eligible?'INGRESSO FICTÍCIO autorizado para treinamento hoje. Confirme a chegada.':'Treinamento não autorizado hoje ou cadastro desativado.'};
}
function createService({query,transaction,now=()=>new Date().toISOString()}){
 async function lookup(code,session){
  if(!allowedSession(code,session))throw fail(403,'Ingresso fictício permitido somente na sua sessão de treinamento.');
  const row=(await query('SELECT state FROM peniel_ops.session_state WHERE session_date=$1',[session])).rows[0];
  if(!row)throw fail(503,'Sessão de treinamento indisponível.');
  return response(row.state,code,session,now());
 }
 async function admit(code,session,user){
  if(!['portaria','geral'].includes(user.role))throw fail(403,'Somente Portaria ou Gestão registram a chegada de treinamento.');
  if(!allowedSession(code,session))throw fail(403,'Ingresso fictício permitido somente na sua sessão de treinamento.');
  return transaction(async db=>{
   const row=(await db.query('SELECT state,revision FROM peniel_ops.session_state WHERE session_date=$1 FOR UPDATE',[session])).rows[0];
   if(!row)throw fail(503,'Sessão de treinamento indisponível.');
   const at=now(),{ticket,used,eligible}=inspect(row.state,code,session,at);
   if(used)throw fail(409,'Código de treinamento já utilizado.');
   if(!eligible)throw fail(409,'Treinamento não autorizado hoje ou cadastro desativado.');
   const next=live.admit({schema:5,revision:Number(row.revision),sessions:{[session]:row.state}},session,{verified:true,participantId:code,registrationId:code,entryId:'training-native',name:ticket.name},at);
   const state=next.db.sessions[session],person=state.people.find(p=>p.id===code);
   person.training=true;person.source='training-ticket';person.admittedBy=user.user_id;
   const stored=state.trainingTickets.find(t=>t.code===code);stored.usedAt=at;stored.usedBy=user.user_id;
   state.history.unshift({at,role:user.role,action:'trainingTicketAdmit',text:ticket.name+': ingresso FICTÍCIO de treinamento admitido. Sem Even3.'});state.history=state.history.slice(0,500);
   await db.query('UPDATE peniel_ops.session_state SET state=$2::jsonb,revision=$3,updated_at=now() WHERE session_date=$1',[session,JSON.stringify(state),next.db.revision]);
   return response(state,code,session,at,true);
  });
 }
 return {lookup,admit};
}
module.exports={SESSION,TEAM_SESSION,parse,inspect,createService};
