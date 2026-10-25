const ops = require('./operation-training.cjs');
const caravans = require('./caravans.cjs');
function command(state, session, role, action, arg, now) {
  if (['scan','reset','takeover'].includes(action)) throw Error('Ação indisponível na operação real.');
  const s=state.sessions[session];
  if(action==='caravanAdmit'){
    if(!['portaria','geral'].includes(role))throw Error('Somente Portaria ou Gestão podem registrar esta entrada.');
    const at=now||new Date().toISOString(),row=caravans.gateRows(s,session,at).find(m=>m.code===arg.code);
    if(!row)throw Error('Integrante não localizado no cadastro direto desta data.');
    if(row.admitted)throw Error('Este integrante já entrou. Não autorize outra entrada.');
    if(!row.eligible)throw Error(row.authorized?'Entrada permitida somente no dia da apresentação.':'Aguarde autorização do Caixa ou da Gestão para esta caravana.');
    const result=admit(state,session,{verified:true,participantId:row.code,registrationId:row.code,entryId:'caravan-native',name:row.name},at);
    const p=result.db.sessions[session].people.find(p=>p.id===row.code);p.source='caravan';p.admittedBy=arg.actorId;
    const message=row.name+' · '+row.caravanName+' · '+row.city+': entrada da caravana registrada. Encaminhar à Coordenação para '+row.group+'.';
    const current=result.db.sessions[session];current.history.unshift({at,role:ops.ROLES[role],action,text:message});current.history=current.history.slice(0,500);
    return {db:result.db,message};
  }
  if(action.startsWith('caravan')){
    if(action==='caravanAuthorize'?!['geral','caixa'].includes(role):!['geral','coordenacao'].includes(role))throw Error(action==='caravanAuthorize'?'Somente Caixa e Gestão podem autorizar recebimento ou cortesia.':'Somente Gestão e Coordenação podem gerenciar caravanas.');
    const next=structuredClone(state),current=next.sessions[session],at=now||new Date().toISOString();
    const message=caravans.handle(current,session,action,arg,at);
    current.history.unshift({at,role:ops.ROLES[role],action,text:message});current.history=current.history.slice(0,500);
    next.revision++;return {db:next,message};
  }
  if(caravans.enabled(session)&&['assign','move'].includes(action)){
    const ids=action==='assign'?(arg.ids||[]):[arg.id];
    for(const id of ids){const p=s.people.find(p=>p.id===id);if(p&&!caravans.compatible(s,session,p,arg.group))throw Error('Integrantes de caravana devem ir ao seu grupo reservado. G06, G07 e G08 são exclusivos para caravanas enquanto reservados.');}
  }
  if(caravans.enabled(session)&&action==='close'){
    const g=s.groups.find(g=>g.id===arg.group);
    const missing=caravans.list(s).filter(c=>c.group===arg.group).flatMap(c=>c.members).filter(m=>!g?.members.includes(m.code));
    if(missing.length&&!String(arg.caravanMissingReason||'').trim())throw Error('Faltam '+missing.length+' integrantes previstos. Aguarde, adie a chamada ou informe o motivo para fechar sem eles.');
  }
  if(action==='start'&&ops.active(s).some(g=>g.status==='circuit'))throw Error('O grupo anterior precisa confirmar o ponto seguro.');
  return ops.apply(state, session, role, action, arg, now);
}
// Internal adapter only: call AFTER verifying the Even3 activity, registration and entitlement.
function admit(state, session, arrival, now=new Date().toISOString()) {
  if (!ops.SESSIONS.some(s=>s.id===session) || !arrival?.verified || !arrival.participantId || !arrival.registrationId || !(arrival.entryId||arrival.activityId) || !String(arrival.name||'').trim()) throw Error('Chegada sem validação completa.');
  const next=structuredClone(state),s=next.sessions[session];
  const id=String(arrival.registrationId);
  if (s.people.some(p=>p.id===id)) return {db:next,duplicate:true};
  if(s.people.length>=ops.capacityFor(session).total) throw Error('Sessão lotada. Encaminhar à coordenação.');
  const caravan=caravans.enabled(session)?caravans.identity(s,id):null;
  s.people.push({id,name:String(arrival.name).trim().slice(0,150),family:arrival.familyId?String(arrival.familyId):id,participantId:String(arrival.participantId),entryId:arrival.entryId?String(arrival.entryId):null,activityId:arrival.activityId?String(arrival.activityId):null,group:null,paperAt:null,arrivedAt:now,...(caravan?{caravan}:{})});
  next.revision++;return {db:next,duplicate:false};
}
function project(state, role) {
  const next=structuredClone(state);
  if(!['geral','coordenacao'].includes(role))for(const s of Object.values(next.sessions)){delete s.caravans;delete s.caravanReleased;}
  if(role==='guias') for(const s of Object.values(next.sessions)) {
    // Guides may see only the participant names of groups called to the waiting area or circuit.
    const visible=new Set(s.groups.filter(g=>['called','waiting','circuit','safe'].includes(g.status)).flatMap(g=>g.members));
    s.people=s.people.filter(p=>visible.has(p.id)).map(p=>({id:p.id,name:p.name,group:p.group,paperAt:p.paperAt}));
    s.history=[];s.lastAssignment=null;
  }
  if(['telao','apoio'].includes(role)) for(const s of Object.values(next.sessions)) {
    // No names or ticket identifiers sent to these roles, including hidden history.
    s.people=s.people.map(p=>({group:p.group,paperAt:p.paperAt}));
    s.groups=s.groups.map(g=>({...g,members:g.members.map(()=>null)}));
    s.history=[];s.lastAssignment=null;
  }
  if(role==='portaria') for(const s of Object.values(next.sessions)){s.history=[];s.lastAssignment=null;}
  return next;
}
module.exports={command,admit,project};
