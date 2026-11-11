const test=require('node:test'),assert=require('node:assert/strict');
const {createService}=require('../lib/official-admission.cjs'),rules=require('../lib/official-entries.cjs'),ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs');
const day='2026-11-13',entry=rules.bySession(day);
function fixture(){
 const state={session:ops.freshSession(day),revision:0,auth:new Map(),attempts:new Map(),sent:new Set()};let queue=Promise.resolve();
 const person=id=>({id_event:'798621',id_attendees:id,checkin_code:id,name:'Treinamento '+id,registration_category:entry.category,confirmed:true});
 const query=async(sql,args=[])=>{
  const code=args[1];
  if(sql.startsWith('SELECT attendee_id'))return {rows:[{attendee_id:code}]};
  if(sql.startsWith('SELECT * FROM peniel_ops.entry_authorizations'))return {rows:state.auth.has(code)?[{...state.auth.get(code)}]:[]};
  if(sql.startsWith('INSERT INTO peniel_ops.entry_authorizations')){if(!state.auth.has(code))state.auth.set(code,{event_id:args[0],ticket_code:code,entry_id:args[2],participant_id:args[3],participant_name:args[4],registration_status:'confirmed',payment_status:'pending',evidence_reference:args[5],verified_at:'2026-11-13'});return {rows:[]};}
  if(sql.includes('SELECT count(*)::int AS total FROM peniel_ops.entry_checkins'))return {rows:[{total:[...state.attempts.values()].filter(a=>a.ticket_code!==code&&['sending','uncertain','confirmed'].includes(a.status)).length}]};
  if(sql.includes('SELECT count(*)::int AS total FROM ('))return {rows:[{total:0}]};
  if(sql.startsWith('SELECT')&&sql.includes('FROM peniel_ops.entry_checkins'))return {rows:state.attempts.has(code)?[{...state.attempts.get(code)}]:[]};
  if(sql.startsWith('SELECT state'))return {rows:[{state:structuredClone(state.session),revision:state.revision}]};
  if(sql.startsWith('INSERT INTO peniel_ops.entry_checkins')){assert.ok(!state.attempts.has(code));state.attempts.set(code,{event_id:args[0],ticket_code:code,entry_id:args[2],attendee_id:args[3],participant_name:args[4],session_date:args[5],status:'sending',requested_at:args[6],requested_by:args[7]});return {rows:[]};}
  if(sql.includes("SET status='confirmed'")){state.attempts.get(code).status='confirmed';return {rows:[]};}
  if(sql.startsWith('UPDATE peniel_ops.session_state')){state.session=JSON.parse(args[1]);state.revision=args[2];return {rows:[]};}
  if(sql.startsWith('UPDATE peniel_ops.entry_authorizations')){state.auth.get(code).checked_in_at='2026-11-13';return {rows:[]};}
  if(sql.includes("SET status='admitted'")){state.attempts.get(code).status='admitted';return {rows:[]};}
  throw Error('Unhandled SQL '+sql);
 };
 const transaction=fn=>{const job=queue.then(()=>fn({query}));queue=job.catch(()=>{});return job;};
 const even3={attendee:async id=>person(id),event:async()=>({id_event:'798621',tickets:[{title:entry.category,prices:[{id_ticket:entry.entryId,id_ticket_price:entry.priceId}]}]}),checkin:async code=>{assert.ok(!state.sent.has(code));state.sent.add(code);await Promise.resolve();return 'OK';}};
 return {state,service:createService({query,transaction,even3,now:()=> '2026-11-13T23:00:00Z'})};
}
test('500 November 13 admissions, four concurrent gates: no numeric cutoff and no automatic groups',async()=>{
 const {state,service}=fixture();
 for(let n=0;n<500;n+=4){const results=await Promise.all(Array.from({length:4},(_,i)=>service.admit(String(88000000+n+i),day,{user_id:'gate-'+i})));assert.ok(results.every(r=>r.admitted));}
 assert.equal(state.session.people.length,500);assert.equal(state.sent.size,500);assert.ok(state.session.people.every(p=>p.group===null&&p.paperAt===null));assert.ok(state.session.groups.every(g=>g.members.length===0));
 await assert.rejects(service.admit('88000500',day,{user_id:'gate-0'}),/lotada/);assert.equal(state.sent.size,500);
 assert.equal((await service.lookup('88000500',day)).found,true,'lookup still finds tickets at capacity');
 const db={schema:5,revision:state.revision,sessions:{[day]:state.session}};
 assert.throws(()=>live.command(db,day,'portaria','assign',{ids:['88000000'],group:'G01'}),/outro posto/);
 const assigned=live.command(db,day,'coordenacao','assign',{ids:['88000000'],group:'G01'}).db;
 assert.equal(assigned.sessions[day].people.filter(p=>p.group).length,1);assert.equal(assigned.sessions[day].people[0].group,'G01');
});
test('closed session rejects before external check-in and preserves all historical state',async()=>{
 const {state,service}=fixture();state.session.closedAt='2026-11-14T02:00:00Z';
 const before=JSON.stringify(state.session);
 await assert.rejects(service.admit('88000000',day,{user_id:'gate'}),/encerrada/);assert.equal(state.sent.size,0);assert.equal(JSON.stringify(state.session),before);
 const db={schema:5,revision:0,sessions:{[day]:state.session}};
 for(const action of ['assign','pause','caravanSave','caravanAdmit'])assert.throws(()=>live.command(db,day,'geral',action,{}),/encerrada/);
 assert.throws(()=>live.admit(db,day,{verified:true,participantId:'p',registrationId:'r',entryId:'e',name:'Pessoa'}),/encerrada/);
 assert.equal(JSON.stringify(state.session),before);assert.equal(live.project(db,'geral').sessions[day].closedAt,state.session.closedAt);
});
