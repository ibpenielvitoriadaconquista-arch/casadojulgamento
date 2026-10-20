const {test}=require('node:test');const assert=require('node:assert/strict');
const {registrationFrom,saveNotification}=require('../lib/even3-registration.cjs');
const confirmed={type:{name:'Participante com inscrição confirmada no evento'},inscricao:{id:10101,codigo:'123'},pessoa:{id:456,nome:'Pessoa de teste'}};
const event={eventId:'798621',notificationId:'test',trigger:confirmed.type.name,occurredAt:'2026-10-18T18:00:00Z',payloadHash:'hash'};
test('confirmed registration does not infer money, date or admission from category',()=>{
 const r=registrationFrom({...confirmed,inscricao:{id:10101,codigo:'123',titulo:'Pago 09/11'}});
 assert.deepEqual(r,{registrationId:'123',participantId:'456',name:'Pessoa de teste',status:'confirmed'});
 for(const body of [{...confirmed,pessoa:{id:456}}, {...confirmed,inscricao:{id:10101}}, {...confirmed,type:{name:'Venda aprovada'}}])assert.equal(registrationFrom(body),null);
});
test('intake persists lifecycle without granting entitlement; late delivery uses newest stored lifecycle',async()=>{
 const calls=[];const cancelled={...confirmed,type:{name:'Participante com inscrição cancelada no evento'}};
 const client={async query(sql,args){calls.push({sql,args});if(sql.startsWith('INSERT INTO even3'))return {rowCount:1};if(sql.startsWith('SELECT payload FROM'))return {rows:[{payload:cancelled},{payload:confirmed}]};return {rows:[]};}};
 const result=await saveNotification(client,event,confirmed);
 assert.equal(result.processing,'registration_recorded_pending_verification');
 const update=calls.find(x=>x.sql.startsWith('INSERT INTO peniel_ops'));
 assert.equal(update.args[4],'cancelled');assert.doesNotMatch(update.sql,/payment_status|activity_id|checked_in_at/);
 assert(calls.some(x=>x.sql.includes('pg_advisory_xact_lock')));
});
test('duplicate conflict cannot update a registration; unknown triggers remain reviewable',async()=>{
 let writes=0;
 const client={async query(sql){if(sql.startsWith('INSERT INTO even3'))return {rowCount:0};if(sql.startsWith('SELECT payload_hash'))return {rows:[{payload_hash:'different'}]};writes++;return {rows:[]};}};
 assert.equal((await saveNotification(client,event,confirmed)).conflict,true);assert.equal(writes,0);
 const saved=[];await saveNotification({async query(sql){saved.push(sql);return {rowCount:1};}},event,{...confirmed,type:{name:'Participante realizou checkin no evento'}});
 assert.equal(saved.length,1);
});

test('real Even3 wrapper and individual codes preserve separate tickets sharing an inscription id',()=>{
 const a={id:'notification',created:1792349011,type:confirmed.type,data:{pessoa:confirmed.pessoa,inscricao:{id:10101,codigo:'123001'}}};
 const b={...a,data:{...a.data,inscricao:{id:10101,codigo:'123002'}}};
 assert.equal(registrationFrom(a).registrationId,'123001');assert.equal(registrationFrom(b).registrationId,'123002');
});

test('preserves numeric individual ticket codes with leading zeroes',()=>{
 const a={...confirmed,inscricao:{id:10101,codigo:'000123'},pessoa:{id:456,nome:'Pessoa de teste'}};
 assert.equal(registrationFrom(a).registrationId,'000123');
});
