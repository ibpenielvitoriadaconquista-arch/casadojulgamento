const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs'),caravans=require('../lib/caravans.cjs'),stock=require('../lib/sales-stock.cjs'),rules=require('../lib/official-entries.cjs');
const day='2026-11-19',at='2026-11-19T22:00:00Z',paper='2026-11-19T15:00:00Z';
function fixture(){
 const db=ops.fresh(),s=db.sessions[day];
 s.people=Array.from({length:7},(_,i)=>({id:'MGT-'+String(i+1).padStart(8,'0')+'-1111-4111-8111-111111111111',name:'Pessoa autorizada '+i,source:'management-list',managementAuthorization:{status:'authorized',by:'gestao-chat-autorizado',at:paper},group:'G02',assignedAt:paper,paperAt:paper,arrivalPending:true,arrivedAt:null}));
 s.groups[1].members=s.people.map(p=>p.id);return db;
}
const run=(db,role,action,arg,now=at)=>live.command(db,day,role,action,{...arg,actorId:'coordenador-real'},now).db;
test('seven names form a normal group without Even3 tickets, caravan reservation or premature arrivals',()=>{
 const db=fixture(),s=db.sessions[day];assert.equal(s.groups[1].members.length,7);assert.equal(ops.groupSizeFor(day,s.groups[1]),35);
 assert.deepEqual(ops.summarize(s),{arrived:0,pending:0,paper:0,active:0});assert.ok(!caravans.reserved(s,day,'G02'));assert.equal(caravans.gateRows(s,day,at).length,0);
 assert.ok(s.people.every(p=>!p.entryId&&!p.participantId&&!p.caravan&&p.arrivedAt===null));
 const catalog={id_event:'798621',tickets:rules.ENTRIES.map(e=>({title:e.category,prices:[{id_ticket:e.entryId,id_ticket_price:e.priceId}]}))};
 const result=stock.calculate({session:day,attendees:[],catalog,state:s,queriedAt:at});assert.equal(result.additionalAdmitted,7);assert.equal(result.protectedCaravanPlaces,105);assert.equal(result.available,388);
});
test('the other 28 places accept regular arrivals and assignment stays with coordination',()=>{
 let db=fixture();
 for(let i=0;i<29;i++){const id=String(90000000+i);db=live.admit(db,day,{verified:true,participantId:id,registrationId:id,entryId:'official',name:'Ingresso '+i},at).db;assert.equal(db.sessions[day].people.at(-1).group,null);}
 const ids=db.sessions[day].people.slice(7,35).map(p=>p.id);db=run(db,'coordenacao','assign',{ids,group:'G02'});assert.equal(db.sessions[day].groups[1].members.length,35);
 assert.throws(()=>run(db,'coordenacao','assign',{ids:['90000028'],group:'G02'}),e=>e.groupLimit?.limit===35&&e.groupLimit.total===36);
});
test('only authorized desks can confirm a listed arrival, once, on the presentation day',()=>{
 const db=fixture(),id=db.sessions[day].people[0].id;
 for(const role of ['portaria','caixa','apoio','telao','caravanas'])assert.throws(()=>run(db,role,'confirmArrival',{id}));
 assert.throws(()=>run(db,'geral','confirmArrival',{id},'2026-11-20T22:00:00Z'),/dia da apresentação/);
 for(const role of ['geral','coordenacao']){const entered=run(db,role,'confirmArrival',{id}),p=entered.sessions[day].people[0];assert.equal(p.arrivedAt,at);assert.equal(p.arrivalPending,false);assert.equal(p.group,'G02');assert.equal(p.paperAt,paper);assert.equal(p.admittedBy,'coordenador-real');assert.equal(ops.summarize(entered.sessions[day]).arrived,1);assert.equal(entered.sessions[day].people.length,7);assert.throws(()=>run(entered,role,'confirmArrival',{id}),/já confirmada/);}
 const revoked=fixture();revoked.sessions[day].people[0].managementAuthorization.status='revoked';assert.throws(()=>run(revoked,'geral','confirmArrival',{id}),/autorização nominal/);
 const ordinary=fixture();ordinary.sessions[day].people[0].source='even3';assert.throws(()=>run(ordinary,'geral','confirmArrival',{id}),/autorização nominal/);
});
test('a pending named assignment cannot be called into the circuit; full arrival follows the existing flow',()=>{
 let db=fixture();assert.throws(()=>run(db,'telao','close',{group:'G02'}),/Confirme a chegada/);
 for(const p of db.sessions[day].people)db=run(db,'coordenacao','confirmArrival',{id:p.id});
 db=run(db,'telao','close',{group:'G02'});db=run(db,'telao','call',{group:'G02',slot:0});db=run(db,'apoio','arrive',{group:'G02'});db=run(db,'apoio','start',{group:'G02',physicallySafe:true});db=run(db,'apoio','safe',{group:'G02'});db=run(db,'apoio','finish',{group:'G02'});assert.equal(db.sessions[day].groups[1].status,'finished');
});
test('display receives counts without names, while coordination has the ordinary nominal group list',()=>{
 const db=fixture(),s=live.project(db,'telao').sessions[day];assert.equal(s.groups[1].arrivalPending,7);assert.equal(ops.summarize(s).arrived,0);
 for(const role of ['telao','apoio','caravanas'])assert.ok(!JSON.stringify(live.project(db,role)).includes('Pessoa autorizada'));
 for(const role of ['geral','coordenacao'])assert.equal(live.project(db,role).sessions[day].groups[1].members.length,7);
});
test('API revalidates a named arrival after an unrelated update and audits the authenticated operator',async()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'../pages/api/operacao/index.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
 const row={state:fixture().sessions[day],revision:12};let writes=0,audit;
 const query=async(sql,args)=>{
  if(sql.startsWith('SELECT state'))return {rows:[structuredClone(row)]};if(sql.includes('SELECT payload_hash'))return {rows:[]};
  if(sql.startsWith('UPDATE peniel_ops.session_state')){row.state=JSON.parse(args[1]);row.revision=args[2];writes++;return {rows:[]};}
  if(sql.startsWith('INSERT INTO peniel_ops.command_log')){audit=args;return {rows:[]};}throw Error(sql);
 };
 const clocked={...live,command:(db,d,role,action,arg)=>live.command(db,d,role,action,arg,at)};
 const handler=new Function('createHash','query','transaction','actor','fail','sameOrigin','ops','live',source)(createHash,query,fn=>fn({query}),async()=>({user_id:'signed-in-coordinator',role:'coordenacao'}),(status,message)=>Object.assign(Error(message),{status}),()=>{},ops,clocked);
 async function call(){const res={setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;this.code||=200;}};await handler({method:'POST',body:{session:day,role:'coordenacao',action:'confirmArrival',arg:{id:row.state.people[0].id,actorId:'forged'},revision:0,requestId:'11111111-1111-4111-8111-111111111111'}},res);return res;}
 assert.equal((await call()).code,200);assert.equal(row.state.people[0].admittedBy,'signed-in-coordinator');assert.equal(audit[1],'signed-in-coordinator');assert.equal(writes,1);
 assert.equal((await call()).code,422);assert.equal(writes,1);assert.equal(ops.summarize(row.state).arrived,1);
});
