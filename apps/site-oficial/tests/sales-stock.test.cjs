const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const stock=require('../lib/sales-stock.cjs'),rules=require('../lib/official-entries.cjs'),ops=require('../lib/operation-training.cjs'),caravans=require('../lib/caravans.cjs'),requests=require('../lib/caravan-requests.cjs');
const catalog={id_event:'798621',tickets:rules.ENTRIES.map(e=>({title:e.category,prices:[{id_ticket:e.entryId,id_ticket_price:e.priceId}]}))};
const person=(i,entry=rules.ENTRIES[1],confirmed=true)=>({id_event:'798621',checkin_code:String(80000000+i),registration_category:entry.category,confirmed});
const calc=(session,attendees=[],state=ops.freshSession(session))=>stock.calculate({session,attendees,catalog,state,queriedAt:'2026-11-08T18:00:00Z'});
test('day 9 counter uses 550, confirmed units rather than payments, and 75 protected caravan seats',()=>{
 const d=calc('2026-11-09',Array.from({length:30},(_,i)=>person(i)));assert.equal(d.capacity,550);assert.equal(d.confirmed,30);assert.equal(d.protectedCaravanPlaces,75);assert.equal(d.available,445);
 assert.equal(calc('2026-11-09',[person(0),person(1,rules.ENTRIES[2]),person(2,rules.ENTRIES[1],false)]).confirmed,1);
 const more=ops.freshSession('2026-11-09');more.groups.push({id:'G26',status:'forming',members:[]});assert.equal(calc('2026-11-09',[],more).capacity,550);
});
test('day 21 protects G03/G04/G05 and 105 places even before the leader lists are entered',()=>{
 const s=ops.freshSession('2026-11-21');s.caravanReleased=['G03'];const d=calc('2026-11-21',Array.from({length:10},(_,i)=>person(i,rules.ENTRIES[6])),s);
 assert.deepEqual(d.reservedGroups,['G03','G04','G05']);assert.equal(d.protectedCaravanPlaces,105);assert.equal(d.available,635);assert.ok(!caravans.reserved(s,'2026-11-21','G06'));
 assert.throws(()=>caravans.handle(s,'2026-11-21','caravanRelease',{group:'G03',reason:'Tentativa de liberar'},new Date().toISOString()));
});
test('overlapping Even3 caravan tickets are counted once, extra admissions count, excess stock never becomes negative',()=>{
 const s=ops.freshSession('2026-11-09');s.caravans=[{group:'G03',members:[{code:'80000000'}]}];s.people=[{id:'different-day'},{id:'CAR-11111111-1111-4111-8111-111111111111'}];
 const d=calc('2026-11-09',[person(0)],s);assert.equal(d.protectedCaravanPlaces,74);assert.equal(d.additionalAdmitted,1);assert.equal(d.available,474);
 const over=calc('2026-11-09',Array.from({length:551},(_,i)=>person(i)));assert.equal(over.available,0);assert.equal(over.overCapacity,true);
 assert.throws(()=>calc('2026-11-09',[person(0),person(0)]));
});
test('incomplete upstream list fails without fabricating available seats',async()=>{
 const service=stock.createService({query:async()=>({rows:[{state:ops.freshSession('2026-11-09')}]}),even3:{request:async()=>({count:30,data:[person(0)]}),items:x=>x.data,event:async()=>catalog}});
 await assert.rejects(service.read('2026-11-09'),/incompleta/);
});
test('public API rejects 21/11 before throttle or insertion; internal input remains valid for existing booked caravans',async()=>{
 const src=fs.readFileSync(path.join(__dirname,'../pages/api/caravana-solicitacao.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');let writes=0;
 const handler=new Function('query','fail','sameOrigin','throttle','requests',src)(async()=>{writes++;throw Error('No write expected');},(status,message)=>Object.assign(Error(message),{status}),()=>{},async()=>{writes++;},requests);
 const body={session:'2026-11-21',name:'Caravana teste',city:'Cidade teste',responsible:'Responsável teste',contact:'77999999999',members:[{name:'Pessoa teste'}],requestId:'11111111-1111-4111-8111-111111111111'};
 assert.equal(requests.input(body).session,'2026-11-21');const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};for(const session of caravans.DAYS.filter(requests.publicClosed)){await handler({method:'POST',body:{...body,session}},res);assert.equal(res.code,409);assert.equal(writes,0);}
});
test('stock endpoint is read-only and restricts the counter to Caixa, Coordenação and Gestão',async()=>{
 const src=fs.readFileSync(path.join(__dirname,'../pages/api/operacao/estoque.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
 let reads=0;const handler=new Function('actor','fail','query','even3','stock',src)(async req=>{if(!req.testRole)throw Object.assign(Error('Login'),{status:401});return {role:req.testRole};},(status,message)=>Object.assign(Error(message),{status}),()=>{throw Error('Unexpected query');},{},{createService:()=>({read:async()=>{reads++;return {available:10};}})});
 for(const role of ['apoio','portaria','caravanas','guias',null,'geral','caixa','coordenacao']){
  const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.code||=200;this.data=data;}};
  await handler({method:'GET',query:{session:'2026-11-09'},testRole:role},res);assert.equal(res.code,!role?401:['geral','caixa','coordenacao'].includes(role)?200:403);
 }
 assert.equal(reads,3);
});

test('Only November 19 accepts public caravan requests',()=>{assert.equal(requests.publicClosed('2026-11-09'),true);assert.equal(requests.publicClosed('2026-11-13'),true);assert.equal(requests.publicClosed('2026-11-14'),true);assert.equal(requests.publicClosed('2026-11-20'),true);assert.equal(requests.publicClosed('2026-11-21'),true);assert.equal(requests.publicClosed('2026-11-19'),false);});

test('November 14 reserves four caravan groups within its total capacity',()=>{const d=calc('2026-11-14');assert.deepEqual(d.reservedGroups,['G03','G04','G06','G08']);assert.equal(d.protectedCaravanPlaces,140);assert.equal(d.capacity,750);assert.equal(d.available,610);});
