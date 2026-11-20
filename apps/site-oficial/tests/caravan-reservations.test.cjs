const test=require('node:test'),assert=require('node:assert/strict');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs'),caravans=require('../lib/caravans.cjs'),stock=require('../lib/sales-stock.cjs'),rules=require('../lib/official-entries.cjs');
const day='2026-11-19',now='2026-11-19T22:00:00Z';
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const members=n=>Array.from({length:n},(_,i)=>({code:'CAR-00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),name:'Pessoa teste '+i,phone:''}));
function fixture(){const db=ops.fresh();for(const [id,capacityOverride] of [['G03',37],['G05',39],['G08',39]])db.sessions[day].groups.find(g=>g.id===id).capacityOverride=capacityOverride;return db;}
const run=(db,action,arg)=>live.command(db,day,'geral',action,arg,now).db;
const draft={id:ids[0],name:'B. Barcelar',city:'Não informada',responsible:'Não informado',group:'G08',members:[],expectedCount:25};
function reserved(){let db=run(fixture(),'caravanSave',draft);db=run(db,'caravanSave',{...draft,id:ids[1],name:'Shekinah',members:members(14),expectedCount:14});return db;}
test('authorized November 19 group limits are restricted to the specified date, groups and values',()=>{
 const db=fixture(),s=db.sessions[day];
 assert.deepEqual(['G03','G05','G08'].map(id=>ops.groupSizeFor(day,s.groups.find(g=>g.id===id))),[37,39,39]);
 assert.equal(ops.groupSizeFor('2026-11-20',{id:'G03',capacityOverride:37}),35);
 assert.equal(ops.groupSizeFor(day,{id:'G01',capacityOverride:39}),35);
 assert.equal(ops.groupSizeFor(day,{id:'G08',capacityOverride:100}),35);
 assert.equal(ops.capacityFor(day).total,500);
});
test('25 unnamed places produce no fictitious spectator, admission or payment authorization',()=>{
 const db=run(fixture(),'caravanSave',draft),s=db.sessions[day],c=s.caravans[0];
 assert.equal(caravans.expectedCount(c),25);assert.equal(caravans.unnamedCount(c),25);assert.equal(c.members.length,0);
 assert.equal(s.people.length,0);assert.deepEqual(caravans.gateRows(s,day,now),[]);
 assert.equal(c.authorization,null);
 assert.throws(()=>run(db,'caravanAuthorize',{id:c.id,method:'pix_igreja',reference:'Teste'}),/Informe os nomes/);
});
test('unnamed places consume reservation capacity and block another list from taking them',()=>{
 const db=reserved(),s=db.sessions[day];assert.equal(caravans.pendingCount(s,'G08'),25);
 assert.equal(s.caravans.reduce((n,c)=>n+caravans.expectedCount(c),0),39);
 const before=JSON.stringify(db);
 assert.throws(()=>run(db,'caravanSave',{...draft,id:ids[2],name:'Outra lista',members:[{code:'99887766',name:'Outra pessoa'}],expectedCount:1}),/39 vagas/);
 assert.equal(JSON.stringify(db),before);
});
test('entering real names gradually replaces unnamed places without duplication or automatic arrival',()=>{
 const db=reserved(),completed=run(db,'caravanSave',{...draft,members:[{code:'CAR-99999999-9999-4999-8999-999999999999',name:'Nome verdadeiro'}]}),s=completed.sessions[day];
 const c=s.caravans.find(c=>c.id===draft.id);assert.equal(caravans.expectedCount(c),25);assert.equal(caravans.unnamedCount(c),24);
 assert.equal(caravans.gateRows(s,day,now).length,15);
 assert.equal(s.people.length,0);assert.equal(c.authorization,null);
 assert.equal(s.caravans.reduce((n,c)=>n+caravans.expectedCount(c),0),39);
});
test('missing names are included in the closing warning and group concurrency version',()=>{
 const db=reserved(),s=db.sessions[day],c=s.caravans.find(c=>c.id===ids[1]),g=s.groups.find(g=>g.id==='G08');
 g.members=c.members.map(m=>m.code);s.people=c.members.map(m=>({id:m.code,name:m.name,group:'G08',paperAt:now}));
 assert.throws(()=>run(db,'close',{group:'G08'}),/Faltam 25/);
 assert.equal(live.project(db,'telao').sessions[day].groups.find(g=>g.id==='G08').caravanMissing,25);
 const version=live.groupVersion(s,'G08');s.caravans[0].expectedCount=24;
 assert.notEqual(live.groupVersion(s,'G08'),version);
});
test('unnamed reservations do not double count in sales stock; three groups protect 115 places within the same total of 500',()=>{
 const state=reserved().sessions[day],catalog={id_event:'798621',tickets:rules.ENTRIES.map(e=>({title:e.category,prices:[{id_ticket:e.entryId,id_ticket_price:e.priceId}]}))};
 const result=stock.calculate({session:day,state,catalog,attendees:[],queriedAt:now});
 assert.equal(result.protectedCaravanPlaces,115);assert.equal(result.capacity,500);assert.equal(result.available,385);
});
test('transferring a known person preserves the remaining unnamed reservation and does not clone its expected size',()=>{
 let db=run(fixture(),'caravanSave',{...draft,expectedCount:2,members:[{code:'99887766',name:'Pessoa conhecida'}]});
 db=run(db,'caravanTransfer',{code:'99887766',group:'G03',id:ids[2],reason:'Troca solicitada'});
 const original=db.sessions[day].caravans.find(c=>c.id===draft.id),other=db.sessions[day].caravans.find(c=>c.id===ids[2]);
 assert.equal(original.members.length,0);assert.equal(caravans.expectedCount(original),1);
 assert.equal(other.members.length,1);assert.equal(caravans.expectedCount(other),1);
});
test('November 20 G06 can protect 26 Filadelfia plus 18 Mortugaba places without increasing daily capacity',()=>{
 const date='2026-11-20',state=ops.freshSession(date),g=state.groups.find(g=>g.id==='G06');
 g.capacityOverride=44;
 assert.equal(ops.groupSizeFor(date,g),44);
 assert.equal(ops.groupSizeFor('2026-11-21',g),35);
 assert.equal(ops.groupSizeFor(date,{id:'G07',capacityOverride:44}),35);
 assert.equal(ops.groupSizeFor(date,{id:'G06',capacityOverride:45}),35);
 const catalog={id_event:'798621',tickets:rules.ENTRIES.map(e=>({title:e.category,prices:[{id_ticket:e.entryId,id_ticket_price:e.priceId}]}))};
 const result=stock.calculate({session:date,state,catalog,attendees:[],queriedAt:now});
 assert.equal(result.protectedCaravanPlaces,149);assert.equal(result.capacity,750);assert.equal(result.available,601);
});
