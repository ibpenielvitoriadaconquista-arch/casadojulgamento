const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs');
const day='2026-11-14';
test('Coordenação and Gestão append sequential groups without changing old groups, other days or capacity',()=>{
 let db=ops.fresh();const original=structuredClone(db),capacity=ops.capacityFor(day);
 for(const role of ['coordenacao','geral'])db=live.command(db,day,role,'addGroup',{}).db;
 assert.deepEqual(db.sessions[day].groups.slice(-2).map(g=>g.id),['G31','G32']);
 assert.deepEqual(db.sessions[day].groups.slice(0,30),original.sessions[day].groups);
 assert.deepEqual(db.sessions['2026-11-09'],original.sessions['2026-11-09']);assert.deepEqual(ops.capacityFor(day),capacity);
 assert.equal(db.revision,2);assert.equal(db.sessions[day].history[0].action,'addGroup');assert.equal(original.sessions[day].groups.length,30);
 for(const role of ['portaria','apoio','telao','caixa','caravanas','guias'])assert.throws(()=>live.command(db,day,role,'addGroup',{}));
 assert.equal(ops.nextGroupId({groups:[{id:'G03'},{id:'G30'}]}),'G31');assert.equal(ops.nextGroupId({groups:[{id:'G99'}]}),'G100');
});
test('extra group supports assignment, paper, called board, support arrival, safe circuit and completion',()=>{
 let db=ops.fresh();const run=(role,action,arg={})=>{db=live.command(db,day,role,action,arg).db;};
 run('coordenacao','addGroup');db=live.admit(db,day,{verified:true,participantId:'person',registrationId:'ticket',entryId:'test',name:'Participante'}).db;
 run('coordenacao','assign',{ids:['ticket'],group:'G31'});run('coordenacao','deliver',{ids:['ticket']});run('telao','close',{group:'G31'});run('telao','call',{group:'G31'});
 const board=live.project(db,'telao').sessions[day];assert.equal(board.groups.find(g=>g.id==='G31').status,'called');assert.ok(!JSON.stringify(board).includes('Participante'));
 assert.equal(live.project(db,'apoio').sessions[day].people[0].name,'Participante');
 for(const action of ['arrive','start','safe','finish'])run('apoio',action,{group:'G31',physicallySafe:true});assert.equal(db.sessions[day].groups.at(-1).status,'finished');
});
test('additional cards never increase spectator limits, per-group size, or simultaneous circuit limit',()=>{
 let db=ops.fresh();db=live.command(db,day,'coordenacao','addGroup',{}).db;const s=db.sessions[day];
 s.people=Array.from({length:ops.capacityFor(day).groupSize+1},(_,i)=>({id:String(i),group:null}));
 assert.throws(()=>live.command(db,day,'coordenacao','assign',{ids:s.people.map(p=>p.id),group:'G31'}),/vagas/);
 for(let i=0;i<3;i++){s.groups[i].status='safe';s.groups[i].members=['member'+i];}s.groups.at(-1).status='waiting';s.groups.at(-1).members=['member31'];
 assert.throws(()=>live.command(db,day,'apoio','start',{group:'G31',physicallySafe:true}),/três/);
 s.people=Array(ops.capacityFor(day).total).fill({id:'occupied'});
 assert.throws(()=>live.admit(db,day,{verified:true,participantId:'new',registrationId:'new',entryId:'test',name:'Novo'}),/lotada/);
});
function apiFixture(){
 const source=fs.readFileSync(path.join(__dirname,'../pages/api/operacao/index.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
 const state={session:ops.freshSession(day),revision:0,logs:new Map(),writes:0};let serial=Promise.resolve();
 const query=async(sql,args=[])=>{
  if(sql.startsWith('SELECT state'))return {rows:[{state:structuredClone(state.session),revision:state.revision}]};
  if(sql.startsWith('SELECT payload_hash'))return {rows:state.logs.has(args[2])?[state.logs.get(args[2])]:[]};
  if(sql.startsWith('UPDATE peniel_ops.session_state')){state.session=JSON.parse(args[1]);state.revision=args[2];state.writes++;return {rows:[]};}
  if(sql.startsWith('INSERT INTO peniel_ops.command_log')){state.logs.set(args[2],{payload_hash:args[3],message:args[5]});return {rows:[]};}
  throw Error('Unexpected query');
 };
 const handler=new Function('createHash','query','transaction','actor','fail','sameOrigin','ops','live',source)(createHash,query,fn=>{const job=serial.then(()=>fn({query}));serial=job.catch(()=>{});return job;},async req=>({user_id:'test-'+req.testRole,role:req.testRole}),(status,message)=>Object.assign(Error(message),{status}),()=>{},ops,live);
 async function call(revision,requestId,role='coordenacao',action='addGroup',arg={}){
  const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.code||=200;this.body=body;return this;}};
  await handler({method:'POST',headers:{},testRole:role,body:{session:day,role,action,arg,revision,requestId}},res);return res;
 }
 return {state,call};
}
test('two coordinators cannot duplicate group numbers; repeated request is idempotent, new revision adds next group',async()=>{
 const f=apiFixture(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 const r=await Promise.all([f.call(0,a),f.call(0,b)]);assert.deepEqual(r.map(x=>x.code).sort(),[200,409]);assert.equal(f.state.session.groups.at(-1).id,'G31');assert.equal(f.state.writes,1);
 assert.equal((await f.call(0,a)).code,200);assert.equal(f.state.writes,1);
 assert.equal((await f.call(1,b)).code,200);assert.equal(f.state.session.groups.at(-1).id,'G32');assert.equal(f.state.logs.size,2);
 for(const role of ['portaria','apoio','caixa','telao','caravanas'])assert.equal((await f.call(2,'33333333-3333-4333-8333-333333333333',role)).code,422);
 assert.equal(f.state.writes,2);
});

test('assignment tolerates unrelated arrivals but prevents duplicate and over-capacity assignments',async()=>{
 const f=apiFixture();f.state.session.people=[{id:'A',name:'Pessoa A',group:null},{id:'B',name:'Pessoa B',group:null}];f.state.revision=10;
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 const results=await Promise.all([f.call(1,a,'coordenacao','assign',{ids:['A'],group:'G01'}),f.call(1,b,'coordenacao','assign',{ids:['B'],group:'G02'})]);
 assert.deepEqual(results.map(r=>r.code),[200,200]);assert.equal(f.state.revision,12);assert.equal(f.state.session.people[0].group,'G01');assert.equal(f.state.session.people[1].group,'G02');
 assert.equal((await f.call(1,a,'coordenacao','assign',{ids:['A'],group:'G01'})).code,200);assert.equal(f.state.writes,2);
 const conflict=await f.call(1,'33333333-3333-4333-8333-333333333333','coordenacao','assign',{ids:['A'],group:'G02'});assert.equal(conflict.code,422);assert.match(conflict.body.error,/já recebeu grupo/);
 f.state.session.people.push({id:'C',name:'Pessoa C',group:null});f.state.session.groups[9].members=Array(35).fill('occupied');
 const full=await f.call(1,'44444444-4444-4444-8444-444444444444','coordenacao','assign',{ids:['C'],group:'G10'});assert.equal(full.code,422);assert.match(full.body.error,/vagas/);assert.equal(f.state.session.people[2].group,null);
});
