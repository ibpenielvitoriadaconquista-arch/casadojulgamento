const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs'),cv=require('../lib/caravans.cjs'),stock=require('../lib/sales-stock.cjs'),rules=require('../lib/official-entries.cjs');
const day='2026-11-21',at=day+'T18:00:00Z';
const members=n=>Array.from({length:n},(_,i)=>({code:'CAR-'+randomUUID(),name:'Integrante '+i,phone:''}));
const run=(db,action,arg,role='geral')=>live.command(db,day,role,action,{...arg,actorId:'gestor'},at).db;
function fixture(){const db=ops.fresh();db.sessions[day].groups[7].capacityOverride=39;return db;}
function save(db,group,count,expectedCount=count){return run(db,'caravanSave',{id:randomUUID(),group,name:'Lista '+randomUUID(),city:'Cidade',responsible:'Responsável',members:members(count),expectedCount});}
function admitOrdinary(db,code){return live.admit(db,day,{verified:true,participantId:code,registrationId:code,entryId:'even3',name:'Pessoa com ingresso'},at).db;}
function planned(){let db=fixture();for(const [g,n,e] of [['G01',17,17],['G01',15,16],['G03',35,35],['G04',35,35],['G07',7,7],['G08',27,27],['G08',12,12]])db=save(db,g,n,e);return db;}
const catalog={id_event:'798621',tickets:rules.ENTRIES.map(e=>({title:e.category,prices:[{id_ticket:e.entryId,id_ticket_price:e.priceId}]}))};

test('November 21 distinguishes exclusive caravans from mixed groups across role projections',()=>{
 const db=planned(),s=db.sessions[day];assert.deepEqual(s.groups.filter(g=>cv.reserved(s,day,g.id)).map(g=>g.id),['G03','G04','G08']);
 for(const group of ['G01','G07']){assert.equal(cv.mixed(day,group),true);assert.equal(cv.reserved(s,day,group),false);assert.equal(cv.acceptsCaravan(s,day,group),true);assert.equal(cv.compatible(s,day,{id:'ordinary'},group),true);}
 assert.equal(cv.reserved(s,day,'G05'),false);assert.equal(cv.compatible(s,day,{id:'ordinary'},'G03'),false);
 assert.deepEqual(live.project(db,'caravanas').sessions[day].groups.map(g=>g.id),['G01','G03','G04','G07','G08']);
 assert.equal(ops.capacityFor(day).total,750);assert.equal(ops.groupSizeFor(day,s.groups[7]),39);
 for(const [date,g] of [['2026-11-20',{id:'G08',capacityOverride:39}],[day,{id:'G07',capacityOverride:39}],[day,{id:'G08',capacityOverride:40}]])assert.equal(ops.groupSizeFor(date,g),35);
});

test('mixed G01 protects 33 planned places and allows two ordinary assignments before asking about overcapacity',()=>{
 let db=planned(),s=db.sessions[day];assert.equal(cv.generalVacancies(s,day,s.groups[0]),2);
 for(let i=0;i<2;i++){db=admitOrdinary(db,'8000010'+i);db=run(db,'assign',{ids:['8000010'+i],group:'G01'},'coordenacao');}
 assert.equal(cv.generalVacancies(db.sessions[day],day,db.sessions[day].groups[0]),0);
 db=admitOrdinary(db,'80000102');let confirmation;
 assert.throws(()=>run(db,'assign',{ids:['80000102'],group:'G01'},'coordenacao'),e=>{confirmation=e.groupLimit;return e.groupLimit?.total===36&&e.groupLimit.includesReservations;});
 db=run(db,'assign',{ids:['80000102'],group:'G01',groupLimitConfirmation:confirmation},'coordenacao');
 assert.equal(db.sessions[day].groups[0].members.length,3);assert.match(db.sessions[day].history[0].text,/reservas de caravanas: 36\/35/);
});

test('ordinary transfer into a mixed group counts future caravan arrivals and cannot reuse a stale capacity confirmation',()=>{
 let db=planned();for(let i=0;i<3;i++){const code='8000020'+i;db=admitOrdinary(db,code);db=run(db,'assign',{ids:[code],group:i<2?'G01':'G02'},'coordenacao');}
 const arg={id:'80000202',group:'G01',reason:'Reunir familiares',expectedMove:{group:'G02',assignedAt:at,paperAt:null}};
 assert.throws(()=>run(db,'move',arg,'coordenacao'),e=>e.groupLimit?.total===36);
 assert.throws(()=>run(db,'move',{...arg,groupLimitConfirmation:{group:'G01',limit:35,total:35}},'coordenacao'),e=>e.groupLimit?.total===36);
 db=run(db,'move',{...arg,groupLimitConfirmation:{group:'G01',limit:35,total:36}},'coordenacao');assert.equal(db.sessions[day].groups[0].members.length,3);
});

test('mixed overcapacity confirmation works when both actual and reserved totals exceed the limit',()=>{
 let db=save(fixture(),'G07',7);for(let i=0;i<36;i++)db=admitOrdinary(db,String(81000000+i));
 const ids=db.sessions[day].people.map(p=>p.id);assert.throws(()=>run(db,'assign',{ids,group:'G07'},'coordenacao'),e=>e.groupLimit?.total===43);
 db=run(db,'assign',{ids,group:'G07',groupLimitConfirmation:{group:'G07',limit:35,total:43}},'coordenacao');assert.equal(db.sessions[day].groups[6].members.length,36);
});

test('native arrivals remain unassigned until Coordination explicitly chooses the mixed or exclusive group',()=>{
 let db=planned();for(const group of ['G01','G07','G08']){
  const c=db.sessions[day].caravans.find(c=>c.group===group),code=c.members[0].code;
  assert.throws(()=>run(db,'caravanAdmit',{code},'portaria'),/Aguarde autorização/);
  db=run(db,'caravanAuthorize',{id:c.id,method:'pix_igreja',reference:'Recebimento apenas na simulação local'});
  db=run(db,'caravanAdmit',{code},'portaria');assert.equal(db.sessions[day].people.find(p=>p.id===code).group,null);
  assert.throws(()=>run(db,'assign',{ids:[code],group:'G02'},'coordenacao'),/seu grupo reservado/);
  db=run(db,'assign',{ids:[code],group},'coordenacao');assert.equal(db.sessions[day].people.find(p=>p.id===code).paperAt,null);
  assert.throws(()=>run(db,'caravanAdmit',{code},'portaria'),/já entrou/);
 }
 assert.equal(cv.generalVacancies(db.sessions[day],day,db.sessions[day].groups[0]),2);
});

test('seven directly admitted G07 members leave 28 places for ordinary attendees and no paper delivered automatically',()=>{
 let db=save(fixture(),'G07',7);const c=db.sessions[day].caravans[0];db=run(db,'caravanAuthorize',{id:c.id,method:'cortesia',reference:'Liberação direta da Gestão apenas em simulação'});
 for(const m of c.members)db=run(db,'caravanAdmit',{code:m.code},'portaria');
 db=run(db,'assign',{ids:c.members.map(m=>m.code),group:'G07'},'geral');
 assert.equal(db.sessions[day].groups[6].members.length,7);assert.equal(cv.generalVacancies(db.sessions[day],day,db.sessions[day].groups[6]),28);
 assert.ok(db.sessions[day].people.every(p=>p.arrivedAt&&!p.paperAt));
 db=admitOrdinary(db,'82000001');db=run(db,'assign',{ids:['82000001'],group:'G07'},'coordenacao');assert.equal(db.sessions[day].groups[6].members.length,8);
 const projected=live.project(db,'caravanas').sessions[day];assert.ok(!JSON.stringify(projected).includes('82000001'));assert.equal(projected.groups.find(g=>g.id==='G07').generalMemberCount,1);assert.equal(cv.generalVacancies(projected,day,projected.groups.find(g=>g.id==='G07')),27);
});

test('G08 stores 27 plus 12 members, retains distinct identities for repeated names and stops a 40th reservation',()=>{
 let db=save(fixture(),'G08',27);db=save(db,'G08',12);
 const c=db.sessions[day].caravans[1];c.members[0].name=c.members[1].name='Nome repetido';assert.equal(new Set(c.members.map(m=>m.code)).size,12);
 assert.equal(cv.gateRows(db.sessions[day],day,at).length,39);
 assert.throws(()=>save(db,'G08',1),/39 vagas/);
});

test('mixed stock protects only the caravan lists, counts confirmed overlap once and includes the missing name reservation',()=>{
 const db=planned(),s=db.sessions[day];let data=stock.calculate({session:day,state:s,catalog,attendees:[],queriedAt:at});
 assert.deepEqual(data.reservedGroups,['G03','G04','G08']);assert.equal(data.mixedPlaces,40);assert.equal(data.protectedCaravanPlaces,149);assert.equal(data.available,601);
 const entry=rules.bySession(day);s.caravans.find(c=>c.group==='G07').members[0].code='83000001';
 data=stock.calculate({session:day,state:s,catalog,attendees:[{id_event:'798621',checkin_code:'83000001',registration_category:entry.category,confirmed:true}],queriedAt:at});
 assert.equal(data.confirmed,1);assert.equal(data.protectedCaravanPlaces,148);assert.equal(data.available,601);
});

test('Telão sees missing arrivals but receives no roster identities; mixed group still requires paper confirmation to close',()=>{
 let db=save(fixture(),'G01',2,3),c=db.sessions[day].caravans[0];db=run(db,'caravanAuthorize',{id:c.id,method:'pix_igreja',reference:'Somente em simulação'});
 db=run(db,'caravanAdmit',{code:c.members[0].code},'portaria');db=run(db,'assign',{ids:[c.members[0].code],group:'G01'},'coordenacao');
 const projected=live.project(db,'telao').sessions[day];assert.equal(projected.groups[0].caravanMissing,2);assert.equal(projected.groups[0].paperPending,1);assert.equal(projected.caravans,undefined);assert.ok(!JSON.stringify(projected).includes(c.members[0].code));
 assert.throws(()=>run(db,'close',{group:'G01',caravanMissingReason:'Aguardar restantes no salão'},'telao'),/senhas/);
 db=run(db,'deliver',{ids:[c.members[0].code],expectedGroup:'G01'},'coordenacao');assert.throws(()=>run(db,'close',{group:'G01'},'telao'),/Faltam 2/);
 db=run(db,'close',{group:'G01',caravanMissingReason:'Ausentes orientados pela Gestão'},'telao');assert.equal(db.sessions[day].groups[0].status,'closed');
});

test('previous dates retain their exclusive groups and do not gain mixed assignment',()=>{
 const dates={'2026-11-09':['G03','G04','G05'],'2026-11-13':['G04','G05','G06'],'2026-11-14':['G03','G04','G06','G08'],'2026-11-19':['G03','G05','G08'],'2026-11-20':['G04','G06','G07','G09']};
 for(const [date,groups] of Object.entries(dates)){assert.deepEqual(cv.groupsFor(date),groups);assert.equal(cv.mixed(date,'G01'),false);assert.equal(cv.mixed(date,'G07'),false);}
});

test('approving a pending G01 request reuses its reserved identities and preserves any unnamed place without automatically admitting anyone',async()=>{
 const fs=require('node:fs'),source=fs.readFileSync(require('node:path').join(__dirname,'../pages/api/operacao/caravana-solicitacoes.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
 const db=save(save(fixture(),'G01',17),'G01',15,16),c=db.sessions[day].caravans[1],codes=c.members.map(m=>m.code),row={state:db.sessions[day],revision:4};let imported=false;
 const payload={...c,contact:'77999999999',session:day,reservedCaravanId:c.id,preferredGroup:'G01'};
 const query=async(sql,args)=>{if(sql.startsWith('SELECT * FROM peniel_ops.caravan_requests'))return {rows:[{id:21,status:'pending',payload}]};if(sql.startsWith('SELECT state'))return {rows:[structuredClone(row)]};if(sql.startsWith('UPDATE peniel_ops.session_state')){row.state=JSON.parse(args[1]);row.revision=args[2];return {rows:[]};}if(sql.startsWith('UPDATE peniel_ops.caravan_requests')){imported=true;return {rows:[]};}throw Error(sql);};
 const handler=new Function('randomUUID','query','transaction','actor','fail','sameOrigin','live','requests',source)(randomUUID,query,fn=>fn({query}),async()=>({role:'geral',user_id:'manager'}),(status,message)=>Object.assign(Error(message),{status}),()=>{},live,require('../lib/caravan-requests.cjs'));
 const res={setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;this.code||=200;}};
 await handler({method:'POST',body:{id:21,group:'G01',method:'pix_igreja',reference:'Pagamento apenas em simulação local',confirmed:true}},res);
 assert.equal(res.code,200);assert.equal(imported,true);assert.equal(row.state.caravans.length,2);const after=row.state.caravans.find(x=>x.id===c.id);assert.deepEqual(after.members.map(m=>m.code),codes);assert.equal(cv.expectedCount(after),16);assert.equal(cv.authorizedCount(after),15);assert.equal(row.state.people.length,0);assert.equal(cv.generalVacancies(row.state,day,row.state.groups[0]),2);
});
