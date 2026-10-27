const {test}=require('node:test');
const assert=require('node:assert/strict');
const {diagnostic}=require('../lib/even3-financial.cjs');
const api=rows=>({request:async()=>({data:rows.map((r,i)=>({id_payment:i+1,...r})),count:rows.length}),items:x=>x.data});
test('financial diagnostic returns aggregate errors without exposing payment data',async()=>{
 const rows=[{reference_payment:'private-reference',buyer:'private-name'},{reference_payment:'another-reference'}];
 const result=await diagnostic(api(rows),async reference=>{if(reference==='private-reference')throw Object.assign(Error('private response body'),{diagnosticCode:'HTTP_404'});return [{email:'private@example.com'}];});
 assert.deepEqual(result,{status:'details_unavailable',paymentCount:2,results:{HTTP_404:1,OK:1}});
 assert.doesNotMatch(JSON.stringify(result),/private|reference|@/);
});
test('unknown upstream errors stay sanitized',async()=>{
 const result=await diagnostic(api([{reference_payment:'ref'}]),async()=>{throw Object.assign(Error('secret'),{diagnosticCode:'secret'});});
 assert.deepEqual(result.results,{UNAVAILABLE:1});
});
test('incomplete payment lists cannot be reported as available',async()=>{
 const result=await diagnostic({request:async()=>({count:2,data:[]}),items:x=>x.data},async()=>{throw Error('must not run');});
 assert.equal(result.status,'incomplete_payment_list');
});
const {reconcile}=require('../lib/even3-financial.cjs');
const payments=Array.from({length:55},(_,i)=>({id_event:798621,id_payment:i+1,reference_payment:'ref-'+i,status_payment:'Pago'}));
const person={id_event:798621,id_attendees:100,name:'Maria',email:'familia@example.org',checkin_code:'12345678'};
const entry={category:'Entrada',entryId:'968577'};
const lot=require('../lib/official-entries.cjs').LOT;
const item=(p=person)=>({id_event:798621,id_payment:55,reference_payment:'ref-54',attendee:p.name,email_attendee:p.email,item:'Entrada',amount:15});
function database(prior){const writes=[];return {writes,query:async(sql,args)=>{if(sql.startsWith('SELECT *'))return {rows:prior?[prior]:[]};if(sql.startsWith('SELECT count'))return {rows:[{total:1}]};writes.push({sql,args});return {rows:[]};}};}
test('training lot is recorded as exempt without consulting payments',async()=>{
 const db=database();await reconcile({p:person,entry:lot,query:db.query,even3:{request:()=>{throw Error('must not query payments');}}});
 assert.equal(db.writes.length,1);assert.match(db.writes[0].sql,/'exempt'/);assert.match(db.writes[0].sql,/DO NOTHING/);assert.equal(db.writes[0].args[1],person.checkin_code);
});
test('training lot never replaces revoked or existing authorization',async()=>{
 for(const prior of [{revoked_at:'2026-10-27'}, {checked_in_at:'2026-10-27'}, {payment_status:'paid'}]){
  const db=database(prior);await reconcile({p:person,entry:lot,query:db.query,even3:{}});assert.equal(db.writes.length,0);
 }
});
test('55 payments use at most four simultaneous requests',async()=>{
 let active=0,max=0,calls=0;
 const result=await diagnostic(api(payments),async()=>{calls++;active++;max=Math.max(max,active);await new Promise(r=>setImmediate(r));active--;return [];});
 assert.equal(result.status,'details_available');assert.equal(calls,55);assert.equal(max,4);
});
test('payment after position 20 authorizes separate family tickets',async()=>{
 for(const p of [person,{...person,id_attendees:101,name:'Pedro',checkin_code:'12345679'}]){
  const db=database();await reconcile({p,entry,query:db.query,even3:api(payments),readDetails:async ref=>ref==='ref-54'?[item(person),item({...person,name:'Pedro'})]:[]});
  assert.equal(db.writes.length,1);assert.equal(db.writes[0].args[1],p.checkin_code);assert.equal(db.writes[0].args[5],'even3-payment:55:ref-54');
 }
});
test('known payment is rechecked and pending payment revokes authorization',async()=>{
 const db=database({evidence_reference:'even3-payment:55:ref-54'});let calls=0;
 await reconcile({p:person,entry,query:db.query,even3:api(payments.map(p=>({...p,status_payment:'Pendente'}))),readDetails:async ref=>{calls++;assert.equal(ref,'ref-54');return [item()];}});
 assert.equal(calls,1);assert.match(db.writes[0].sql,/revoked_at=now/);
});
test('partial duplicate ambiguous or failed responses cannot authorize',async()=>{
 for(const scenario of ['partial','duplicate','ambiguous','failure']){
  const db=database();const rows=scenario==='duplicate'?[payments[0],payments[0]]:payments;
  const even3=scenario==='partial'?{request:async()=>({count:56,data:payments}),items:x=>x.data}:api(rows);
  await reconcile({p:person,entry,query:db.query,even3,readDetails:async ref=>{if(scenario==='failure')throw Error('network');return ref==='ref-54'?(scenario==='ambiguous'?[item(),item()]:[item()]):[];}});
  assert.equal(db.writes.length,0,scenario);
 }
});
test('failed refresh of previous evidence blocks admission',async()=>{
 const db=database({evidence_reference:'even3-payment:55:ref-54'});
 await assert.rejects(reconcile({p:person,entry,query:db.query,even3:api(payments),readDetails:async()=>{throw Error('HTTP 404');}}),e=>e.status===503);
 assert.equal(db.writes.length,0);
});
