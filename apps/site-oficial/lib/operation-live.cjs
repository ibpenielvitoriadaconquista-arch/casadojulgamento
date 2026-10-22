const ops = require('./operation-training.cjs');
function command(state, session, role, action, arg, now) {
  if (['scan','reset','takeover'].includes(action)) throw Error('Ação indisponível na operação real.');
  return ops.apply(state, session, role, action, arg, now);
}
// Internal adapter only: call AFTER verifying the Even3 activity, registration and entitlement.
function admit(state, session, arrival, now=new Date().toISOString()) {
  if (!ops.SESSIONS.some(s=>s.id===session) || !arrival?.verified || !arrival.participantId || !arrival.registrationId || !(arrival.entryId||arrival.activityId) || !String(arrival.name||'').trim()) throw Error('Chegada sem validação completa.');
  const next=structuredClone(state),s=next.sessions[session];
  const id=String(arrival.registrationId);
  if (s.people.some(p=>p.id===id)) return {db:next,duplicate:true};
  if(s.people.length>=300) throw Error('Sessão lotada. Encaminhar à coordenação.');
  s.people.push({id,name:String(arrival.name).trim().slice(0,150),family:arrival.familyId?String(arrival.familyId):id,participantId:String(arrival.participantId),entryId:arrival.entryId?String(arrival.entryId):null,activityId:arrival.activityId?String(arrival.activityId):null,group:null,paperAt:null,arrivedAt:now});
  next.revision++;return {db:next,duplicate:false};
}
function project(state, role) {
  const next=structuredClone(state);
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
