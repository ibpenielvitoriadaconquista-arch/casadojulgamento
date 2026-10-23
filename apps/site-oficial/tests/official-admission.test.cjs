const test=require('node:test'),assert=require('node:assert/strict');
const {createService}=require('../lib/official-admission.cjs');
const rules=require('../lib/official-entries.cjs'),ops=require('../lib/operation-training.cjs');
const p={id_event:'798621',id_attendees:'42',name:'Pessoa',checkin_code:'12345678',registration_category:rules.LOT.category,confirmed:true};
const catalog={id_event:'798621',tickets:[{title:rules.LOT.category,prices:[{id_ticket:'968141',id_ticket_price:'1097995'}]}]};
function fixture({timeout=false,failFinalize=false}={}){
 const state={auth:{event_id:'798621',ticket_code:p.checkin_code,entry_id:rules.LOT.entryId,participant_id:'42',participant_name:p.name,registration_status:'confirmed',payment_status:'paid',evidence_reference:'receipt-1:item-1',verified_at:'2026-10-22'},attempt:null,session:ops.fresh().sessions[rules.LOT.session],revision:0,sends:0,failFinalize};
 let queue=Promise.resolve(),inside=false;
 const query=async(sql,args=[])=>{
  if(sql.startsWith('SELECT attendee_id'))return {rows:[{attendee_id:'42'}]};
  if(sql.startsWith('SELECT * FROM peniel_ops.entry_authorizations'))return {rows:state.auth?[{...state.auth}]:[]};
  if(sql.startsWith('SELECT')&&sql.includes('FROM peniel_ops.entry_checkins'))return sql.includes('count(*)')?{rows:[{total:state.attempt&&state.attempt.status!=='admitted'?1:0}]}:{rows:state.attempt?[{...state.attempt}]:[]};
  if(sql.startsWith('SELECT state'))return {rows:[{state:structuredClone(state.session),revision:state.revision}]};
  if(sql.startsWith('INSERT INTO peniel_ops.entry_checkins')){state.attempt={event_id:args[0],ticket_code:args[1],entry_id:args[2],attendee_id:args[3],participant_name:args[4],session_date:args[5],status:'sending',requested_at:args[6],requested_by:args[7]};return {rows:[]};}
  if(sql.includes("SET status='uncertain'")){state.attempt.status='uncertain';return {rows:[]};}
  if(sql.includes("SET status='confirmed'")){state.attempt.status='confirmed';return {rows:[]};}
  if(sql.startsWith('UPDATE peniel_ops.session_state')){if(state.failFinalize){state.failFinalize=false;throw Error('database unavailable');}state.session=JSON.parse(args[1]);state.revision=args[2];return {rows:[]};}
  if(sql.startsWith('UPDATE peniel_ops.entry_authorizations')){state.auth.checked_in_at='2026-10-22';return {rows:[]};}
  if(sql.includes("SET status='admitted'")){state.attempt.status='admitted';return {rows:[]};}
  throw Error('Unhandled query '+sql);
 };
 const transaction=fn=>{const job=queue.then(async()=>{inside=true;try{return await fn({query});}finally{inside=false;}});queue=job.catch(()=>{});return job;};
 const even3={attendee:async()=>({...p}),event:async()=>catalog,checkin:async()=>{assert.equal(inside,false,'HTTP must be outside database transaction');state.sends++;await new Promise(r=>setTimeout(r,5));if(timeout)throw Error('timeout');return 'OK';}};
 return {state,even3,service:createService({query,transaction,even3,now:()=>new Date('2026-10-22T23:00:00-03:00').toISOString()})};
}
test('Lote 1 é oficial em 22 e 23; novembro permanece restrito a cada data',()=>{
 assert.equal(rules.ENTRIES.length,7);
 for(const day of ['2026-10-22','2026-10-23'])assert.equal(rules.validate(p,rules.LOT,day),null);
 assert.ok(rules.validate(p,rules.LOT,'2026-10-24'));
 for(const e of rules.ENTRIES.slice(1)){assert.equal(rules.validate({...p,registration_category:e.category},e,e.session),null);assert.ok(rules.validate({...p,registration_category:e.category},e,'2026-10-23'));}
});
test('cancelamento e divergência de categoria bloqueiam',()=>{assert.ok(rules.validate({...p,confirmed:false},rules.LOT,'2026-10-22'));assert.ok(rules.validate({...p,id_event:'1'},rules.LOT,'2026-10-22'));assert.equal(rules.catalogMatches({...catalog,id_event:'1'},rules.LOT),false);});
test('duas portarias concorrentes fazem um envio e uma admissão',async()=>{const {state,service}=fixture();const r=await Promise.allSettled([service.admit(p.checkin_code,rules.LOT.session,{user_id:'u1'}),service.admit(p.checkin_code,rules.LOT.session,{user_id:'u2'})]);assert.equal(r.filter(x=>x.status==='fulfilled'&&x.value.admitted).length,1);assert.equal(state.sends,1);assert.equal(state.session.people.length,1);assert.equal(state.attempt.status,'admitted');});
test('timeout mantém reserva e não reenvia',async()=>{const {state,service}=fixture({timeout:true});await assert.rejects(service.admit(p.checkin_code,rules.LOT.session,{user_id:'u1'}));await assert.rejects(service.admit(p.checkin_code,rules.LOT.session,{user_id:'u2'}));assert.equal(state.sends,1);assert.equal(state.attempt.status,'uncertain');assert.equal(state.session.people.length,0);});
test('falha local depois do OK permite retomar sem outro envio',async()=>{const {state,service}=fixture({failFinalize:true});await assert.rejects(service.admit(p.checkin_code,rules.LOT.session,{user_id:'u1'}));assert.equal(state.attempt.status,'confirmed');const r=await service.admit(p.checkin_code,rules.LOT.session,{user_id:'u1'});assert.equal(r.admitted,true);assert.equal(state.sends,1);assert.equal(state.session.people.length,1);});
test('sem pagamento comprovado nunca chama check-in',async()=>{const {state,service}=fixture();state.auth=null;await assert.rejects(service.admit(p.checkin_code,rules.LOT.session,{user_id:'u1'}));assert.equal(state.sends,0);assert.equal(state.attempt,null);});
const financial=require('../lib/even3-financial.cjs');
test('conciliação exige vínculo individual de evento, categoria, nome e email',()=>{
 const person={...p,email:'pessoa@example.org'};
 const item={id_event:'798621',attendee:'Pessoa',email_attendee:'pessoa@example.org',item:rules.LOT.category};
 assert.equal(financial.matches(item,person,rules.LOT),true);
 for(const bad of [{id_event:'1'},{email_attendee:'outra@example.org'},{attendee:'Outro'},{item:'TESTE'}])assert.equal(financial.matches({...item,...bad},person,rules.LOT),false);
});
