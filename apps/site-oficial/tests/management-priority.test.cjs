const test=require('node:test'),assert=require('node:assert/strict');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs'),caravans=require('../lib/caravans.cjs'),stock=require('../lib/sales-stock.cjs'),rules=require('../lib/official-entries.cjs');
const day='2026-11-19',at='2026-11-19T22:00:00Z',paper='2026-11-19T14:00:00Z';
function fixture(){
 const db=ops.fresh(),s=db.sessions[day];
 Object.assign(s.groups[1],{managementReserved:true,capacityOverride:7,priorityExpected:7});
 s.caravans=[{id:'11111111-1111-4111-8111-111111111111',name:'Liberação direta da Gestão',city:'Prioridade idosos',responsible:'Gestão',contact:'',group:'G02',managementRelease:true,preassignment:{group:'G02',paperDeliveredAt:paper,by:'gestao-chat-autorizado'},authorization:{status:'authorized',method:'liberacao_gestao'},members:Array.from({length:7},(_,i)=>({code:'CAR-'+String(i+1).padStart(8,'0')+'-1111-4111-8111-111111111111',name:'Convidado '+(i+1),phone:''}))}];
 return db;
}
const run=(db,role,action,arg,now=at)=>live.command(db,day,role,action,{...arg,actorId:'porteiro-real'},now).db;
test('preassignment protects exactly seven seats and registers no arrival or external checkin',()=>{
 const db=fixture(),s=db.sessions[day],rows=caravans.gateRows(s,day,at);
 assert.deepEqual(ops.summarize(s),{arrived:0,pending:0,paper:0,active:0});assert.deepEqual(s.groups[1].members,[]);
 assert.equal(rows.length,7);assert.ok(rows.every(r=>!r.admitted&&r.eligible&&r.managementRelease));
 assert.ok(caravans.reserved(s,day,'G02'));assert.ok(!caravans.groupsFor(day).includes('G02'));assert.equal(ops.groupSizeFor(day,s.groups[1]),7);
 const catalog={id_event:'798621',tickets:rules.ENTRIES.map(e=>({title:e.category,prices:[{id_ticket:e.entryId,id_ticket_price:e.priceId}]}))};
 const result=stock.calculate({session:day,attendees:[],catalog,state:s,queriedAt:at});assert.equal(result.protectedCaravanPlaces,112);assert.equal(result.available,388);
 const plain=ops.freshSession(day);assert.equal(ops.groupSizeFor(day,plain.groups[1]),35);assert.ok(!caravans.reserved(plain,day,'G02'));
});
test('only actual Portaria confirmation consumes management preassignment, preserving paper evidence',()=>{
 let db=fixture();const roster=db.sessions[day].caravans[0];
 assert.throws(()=>run(db,'portaria','caravanAdmit',{code:roster.members[0].code},'2026-11-20T22:00:00Z'),/dia da apresentação/);
 assert.throws(()=>run(db,'coordenacao','caravanAdmit',{code:roster.members[0].code}),/Somente Portaria/);
 for(const m of roster.members){db=run(db,'portaria','caravanAdmit',{code:m.code});assert.throws(()=>run(db,'portaria','caravanAdmit',{code:m.code}),/já entrou/);}
 const s=db.sessions[day];assert.equal(s.people.length,7);assert.equal(s.groups[1].members.length,7);
 assert.ok(s.people.every(p=>p.arrivedAt===at&&p.assignedAt===at&&p.group==='G02'&&p.paperAt===paper&&p.source==='management-release'&&p.admittedBy==='porteiro-real'));
 assert.deepEqual(ops.summarize(s),{arrived:7,pending:0,paper:0,active:0});
 db=run(db,'telao','close',{group:'G02'});db=run(db,'telao','call',{group:'G02',slot:0});db=run(db,'apoio','arrive',{group:'G02',supportPost:'recepcao'});db=run(db,'apoio','start',{group:'G02',supportPost:'recepcao',physicallySafe:true});db=run(db,'apoio','safe',{group:'G02',supportPost:'seguro'});db=run(db,'apoio','finish',{group:'G02',supportPost:'saida'});assert.equal(db.sessions[day].groups[1].status,'finished');
});
test('missing people prevent premature closing; revoked or closed preassignment cannot admit',()=>{
 let db=fixture(),code=db.sessions[day].caravans[0].members[0].code;db=run(db,'portaria','caravanAdmit',{code});assert.throws(()=>run(db,'telao','close',{group:'G02'}),/Faltam 6/);
 for(const mutate of [s=>s.groups[1].status='closed',s=>s.caravans[0].authorization.status='revoked',s=>s.caravans[0].preassignment.paperDeliveredAt=null]){const x=fixture();mutate(x.sessions[day]);assert.throws(()=>run(x,'portaria','caravanAdmit',{code}));assert.equal(x.sessions[day].people.length,0);}
});
test('priority names are private to authorized desks and cannot become caravan payment records',()=>{
 const db=fixture(),c=db.sessions[day].caravans[0];
 for(const role of ['telao','apoio','caravanas'])assert.ok(!JSON.stringify(live.project(db,role)).includes('Convidado 1'));
 for(const role of ['geral','coordenacao'])assert.ok(JSON.stringify(live.project(db,role)).includes('Convidado 1'));
 for(const action of ['caravanSave','caravanTransfer','caravanAuthorize','caravanDelete','caravanTraining'])assert.throws(()=>run(db,'geral',action,{id:c.id,code:c.members[0].code,method:'pix_igreja',group:'G03'}),/Liberação direta/);
 const ordinary=live.admit(db,day,{verified:true,registrationId:'78898555',participantId:'1234',entryId:'968577',name:'Nome igual'},at).db.sessions[day].people[0];assert.equal(ordinary.group,null);assert.equal(ordinary.paperAt,null);
});
