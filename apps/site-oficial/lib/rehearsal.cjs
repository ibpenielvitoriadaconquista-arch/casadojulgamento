'use strict';
const initial=()=>({revision:0,current:null,history:[]});
const elapsed=(run,now=Date.now())=>run?Math.max(0,run.elapsedMs+(run.startedAt===null?0:now-run.startedAt)):0;
function apply(state,action,input={},actor,now=Date.now()){
 if(!['apoio','geral'].includes(actor?.role))throw Error('Somente Apoio e Gestão podem cronometrar.');
 const next=structuredClone(state),run=next.current;
 if(run&&run.owner!==actor.user_id&&actor.role!=='geral')throw Error('Este posto está sendo cronometrado por outro colaborador.');
 if(action==='start'){
  if(run)throw Error('Conclua a etapa atual antes de iniciar outra.');
  const label=String(input.label||'').trim();
  if(!label||label.length>80||!['cena','deslocamento','intervalo'].includes(input.kind))throw Error('Informe a etapa e o tipo de medição.');
  const targetMinutes=Number(input.targetMinutes||0);
  if(!Number.isFinite(targetMinutes)||targetMinutes<0||targetMinutes>120)throw Error('A meta deve estar entre 0 e 120 minutos.');
  next.current={label,kind:input.kind,targetMs:Math.round(targetMinutes*60000),elapsedMs:0,startedAt:now,createdAt:now,owner:actor.user_id};
 }else if(action==='pause'){
  if(!run||run.startedAt===null)throw Error('Não há medição em andamento.');
  run.elapsedMs=elapsed(run,now);run.startedAt=null;
 }else if(action==='resume'){
  if(!run||run.startedAt!==null)throw Error('Não há medição pausada.');run.startedAt=now;
 }else if(action==='finish'){
  if(!run)throw Error('Não há etapa para concluir.');
  if(next.history.length>=500)throw Error('Limite de 500 etapas neste posto. Exporte o histórico e procure a gestão.');
  next.history.unshift({...run,elapsedMs:elapsed(run,now),finishedAt:now,startedAt:null,finishedBy:actor.user_id});next.current=null;
 }else throw Error('Comando inválido.');
 next.revision++;return next;
}
module.exports={initial,elapsed,apply};
