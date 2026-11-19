const ops = require('./operation-training.cjs');
const caravans = require('./caravans.cjs');
const {createHash}=require('node:crypto');
// Covers only this group's participants, paper delivery and stage, not other arrivals.
// Hashed before role redaction so Telão never receives participant identifiers.
function groupVersion(s,id){
 const g=s.groups.find(g=>g.id===id);if(!g)return null;
 const members=[...g.members].sort().map(id=>{const p=s.people.find(p=>p.id===id);return [id,p?.group??null,p?.assignedAt??null,p?.paperAt??null,p?.arrivalPending===true,p?.arrivedAt??null];});
 const expectedCaravan=caravans.list(s).filter(c=>c.group===id).map(c=>[c.id,caravans.expectedCount(c),c.members.map(m=>m.code).sort()]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 const stage=['status','calledAt','closedAt','arrivedAt','startedAt','safeAt','finishedAt','caravanDeferred','capacityOverride'].map(key=>[key,g[key]??null]);
 return createHash('sha256').update(JSON.stringify({id,stage,members,expectedCaravan})).digest('hex');
}
function command(state, session, role, action, arg, now) {
  if (['scan','reset','takeover'].includes(action)) throw Error('Ação indisponível na operação real.');
  const s=state.sessions[session];
  if(s?.closedAt)throw Error('Apresentação encerrada. Histórico disponível somente para consulta.');
  if(action==='confirmArrival'&&caravans.bahiaDay(now||new Date().toISOString())!==session)throw Error('Confirme a chegada somente no dia da apresentação.');
  if(ops.isGroupCommand(action)&&arg.expectedGroupVersion!==undefined&&arg.expectedGroupVersion!==groupVersion(s,arg.group))throw Object.assign(Error(arg.group+' foi alterado ou a ação já foi executada. Confira o estado atual desse grupo antes de confirmar novamente.'),{groupConflict:true});
  if(role==='caravanas'){
    if(!['caravanSave','caravanDelete','caravanTransfer','caravanAuthorize'].includes(action))throw Error('Este acesso administra somente cadastros e recebimentos de caravanas.');
    if(action==='caravanAuthorize'&&!['dinheiro','pix_igreja','revogar'].includes(arg.method))throw Error('Somente Gestão autoriza cortesias.');
  }
  if(action==='caravanAdmit'){
    if(!['portaria','geral'].includes(role))throw Error('Somente Portaria ou Gestão podem registrar esta entrada.');
    const at=now||new Date().toISOString(),row=caravans.gateRows(s,session,at).find(m=>m.code===arg.code);
    if(!row)throw Error('Integrante não localizado no cadastro direto desta data.');
    if(row.admitted)throw Error('Este integrante já entrou. Não autorize outra entrada.');
    if(!row.eligible)throw Error(row.authorized?'Entrada permitida somente no dia da apresentação.':'Aguarde autorização do Caixa ou da Gestão para esta caravana.');
    const result=admit(state,session,{verified:true,participantId:row.code,registrationId:row.code,entryId:'caravan-native',name:row.name},at);
    const p=result.db.sessions[session].people.find(p=>p.id===row.code);p.source='caravan';p.admittedBy=arg.actorId;if(row.training)p.training=true;
    const message=row.name+' · '+row.caravanName+' · '+row.city+': entrada da caravana registrada. Encaminhar à Coordenação para '+row.group+'.';
    const current=result.db.sessions[session];current.history.unshift({at,role:ops.ROLES[role],action,text:message});current.history=current.history.slice(0,500);
    return {db:result.db,message};
  }
  if(action.startsWith('caravan')){
    if(action==='caravanTraining'&&role!=='geral')throw Error('Somente Gestão pode autorizar treinamento fora da data.');
    if(action==='caravanAuthorize'?!['geral','caixa','caravanas'].includes(role):!['geral','coordenacao','caravanas'].includes(role))throw Error(action==='caravanAuthorize'?'Somente Caixa e Gestão podem autorizar recebimento ou cortesia.':'Somente Gestão e Coordenação podem gerenciar caravanas.');
    const next=structuredClone(state),current=next.sessions[session],at=now||new Date().toISOString();
    const message=caravans.handle(current,session,action,arg,at);
    current.history.unshift({at,role:ops.ROLES[role],action,text:message});current.history=current.history.slice(0,500);
    next.revision++;return {db:next,message};
  }
  if(caravans.enabled(session)&&['assign','move'].includes(action)){
    const ids=action==='assign'?(arg.ids||[]):[arg.id];
    for(const id of ids){const p=s.people.find(p=>p.id===id);if(p&&!caravans.compatible(s,session,p,arg.group))throw Error('Integrantes de caravana devem ir ao seu grupo reservado. Os grupos reservados são exclusivos para caravanas.');}
  }
  if(caravans.enabled(session)&&action==='close'){
    const g=s.groups.find(g=>g.id===arg.group);
    const missing=caravans.list(s).filter(c=>c.group===arg.group).flatMap(c=>c.members).filter(m=>!g?.members.includes(m.code));
    const missingCount=missing.length+caravans.pendingCount(s,arg.group);
    if(missingCount&&!String(arg.caravanMissingReason||'').trim())throw Error('Faltam '+missingCount+' integrantes previstos. Aguarde, adie a chamada ou informe o motivo para fechar sem eles.');
  }
  if(action==='start'&&ops.active(s).some(g=>g.status==='circuit'))throw Error('O grupo anterior precisa confirmar o ponto seguro.');
  return ops.apply(state, session, role, action, arg, now);
}
// Internal adapter only: call AFTER verifying the Even3 activity, registration and entitlement.
function admit(state, session, arrival, now=new Date().toISOString()) {
  if (!ops.SESSIONS.some(s=>s.id===session) || !arrival?.verified || !arrival.participantId || !arrival.registrationId || !(arrival.entryId||arrival.activityId) || !String(arrival.name||'').trim()) throw Error('Chegada sem validação completa.');
  const next=structuredClone(state),s=next.sessions[session];
  if(s.closedAt)throw Error('Apresentação encerrada. Novas chegadas não são permitidas.');
  const id=String(arrival.registrationId);
  if (s.people.some(p=>p.id===id)) return {db:next,duplicate:true};
  if(s.people.length>=ops.capacityFor(session).total) throw Error('Sessão lotada. Encaminhar à coordenação.');
  const caravan=caravans.enabled(session)?caravans.identity(s,id):null;
  s.people.push({id,name:String(arrival.name).trim().slice(0,150),family:arrival.familyId?String(arrival.familyId):id,participantId:String(arrival.participantId),entryId:arrival.entryId?String(arrival.entryId):null,activityId:arrival.activityId?String(arrival.activityId):null,group:null,paperAt:null,arrivedAt:now,...(caravan?{caravan}:{})});
  next.revision++;return {db:next,duplicate:false};
}
function project(state, role) {
  if(!Object.hasOwn(ops.ROLES,role))throw Error('Posto desativado ou inválido.');
  const next=structuredClone(state);
  if(['geral','coordenacao','telao','apoio'].includes(role))for(const s of Object.values(next.sessions))for(const g of s.groups)g.commandVersion=groupVersion(s,g.id);
  for(const s of Object.values(next.sessions))delete s.trainingTickets;
  if(!['geral','coordenacao','caravanas'].includes(role))for(const s of Object.values(next.sessions)){delete s.caravans;delete s.caravanReleased;}
  if(role==='caravanas')for(const [day,s] of Object.entries(next.sessions)){
    const codes=new Set(caravans.list(s).flatMap(c=>c.members.map(m=>m.code)));
    s.people=s.people.filter(p=>codes.has(p.id)).map(p=>({id:p.id,name:p.name,group:p.group,arrivedAt:p.arrivedAt}));
    s.groups=s.groups.filter(g=>caravans.groupsFor(day).includes(g.id)).map(g=>({...g,guide:null}));
    s.history=[];s.lastAssignment=null;
  }
  if(role==='apoio') for(const s of Object.values(next.sessions)) {
    // Support may see only the participant names of groups called to the waiting area or circuit.
    const visible=new Set(s.groups.filter(g=>['called','waiting','circuit','safe'].includes(g.status)).flatMap(g=>g.members));
    s.people=s.people.filter(p=>visible.has(p.id)).map(p=>({id:p.id,name:p.name,group:p.group,paperAt:p.paperAt}));
    s.history=[];s.lastAssignment=null;
  }
  if(role==='telao') for(const [day,s] of Object.entries(next.sessions)) {
    // No names or ticket identifiers sent to these roles, including hidden history.
    s.people=s.people.map(p=>({group:p.group,paperAt:p.paperAt,arrivalPending:p.arrivalPending===true}));
    s.groups=s.groups.map(g=>({...g,guide:null,arrivalPending:g.members.filter(id=>state.sessions[day].people.find(p=>p.id===id)?.arrivalPending===true).length,caravanMissing:caravans.list(state.sessions[day]).filter(c=>c.group===g.id).flatMap(c=>c.members).filter(m=>!g.members.includes(m.code)).length+caravans.pendingCount(state.sessions[day],g.id),paperPending:g.members.filter(id=>!state.sessions[day].people.find(p=>p.id===id)?.paperAt).length,members:g.members.map(()=>null)}));
    s.history=[];s.lastAssignment=null;
  }
  if(role==='portaria') for(const s of Object.values(next.sessions)){s.history=[];s.lastAssignment=null;}
  return next;
}
module.exports={command,admit,project,groupVersion};
