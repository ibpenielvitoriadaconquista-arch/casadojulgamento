const test=require('node:test'),assert=require('node:assert/strict');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs');
const day='2026-11-13';
function setup(){let db=ops.fresh();db.sessions[day].caravanReleased=['G04'];let clock=Date.parse('2026-11-13T22:00:00Z');const run=(role,action,arg={})=>{db=live.command(db,day,role,action,arg,new Date(clock+=1000).toISOString()).db;};for(let i=1;i<=4;i++){const id='ticket-'+i,group='G0'+i;db=live.admit(db,day,{verified:true,participantId:id,registrationId:id,entryId:'entry',name:'Pessoa '+i}).db;run('coordenacao','assign',{ids:[id],group});run('coordenacao','deliver',{ids:[id]});run('telao','close',{group});}return {get db(){return db},get s(){return db.sessions[day]},run};}
function enter(x,group,slot){x.run('telao','call',{group,slot});x.run('apoio','arrive',{group});x.run('apoio','start',{group,physicallySafe:true});}
test('three reserved slots include calls, remain stable, and release only the finished group',()=>{
 const x=setup();enter(x,'G01',2);assert.throws(()=>x.run('telao','call',{group:'G02'}),/ponto seguro/);x.run('apoio','safe',{group:'G01'});
 enter(x,'G02',0);x.run('apoio','safe',{group:'G02'});x.run('telao','call',{group:'G03',slot:1});
 assert.deepEqual(ops.circuitSlots(x.s).map(g=>g?.id),['G02','G03','G01']);assert.equal(ops.occupied(x.s).length,3);
 const before=JSON.stringify(x.db);assert.throws(()=>x.run('telao','call',{group:'G04'}),/três vagas/);assert.equal(JSON.stringify(x.db),before);
 x.run('apoio','arrive',{group:'G03'});x.run('apoio','start',{group:'G03',physicallySafe:true});x.run('apoio','safe',{group:'G03'});x.run('apoio','finish',{group:'G02'});
 assert.deepEqual(ops.circuitSlots(x.s).map(g=>g?.id||null),[null,'G03','G01']);x.run('telao','call',{group:'G04',slot:0});assert.deepEqual(ops.circuitSlots(x.s).map(g=>g?.id),['G04','G03','G01']);
 assert.equal(x.s.groups[1].status,'finished');assert.equal(x.s.people.length,4);assert.equal(x.db.sessions['2026-11-09'].people.length,0);
});
test('safe signal survives reload/call and is acknowledged only by next arrival',()=>{
 const x=setup();enter(x,'G01',0);x.run('apoio','safe',{group:'G01'});assert.equal(JSON.parse(JSON.stringify(x.s)).supportSignal.acknowledgedAt,null);
 x.run('telao','call',{group:'G02',slot:1});assert.equal(x.s.supportSignal.acknowledgedAt,null);
 x.run('apoio','arrive',{group:'G02'});assert.ok(x.s.supportSignal.acknowledgedAt);assert.equal(x.s.supportSignal.receivedGroup,'G02');
 assert.throws(()=>x.run('apoio','arrive',{group:'G02'}));
});
test('Telão may close and call but cannot assign people, change payments or finish; coordination cannot call',()=>{
 const x=setup();for(const action of ['call','close','reopen'])assert.throws(()=>x.run('coordenacao',action,{group:'G01'}),/outro posto/);
 for(const action of ['assign','deliver','arrive','start','safe','finish','pause','caravanAuthorize'])assert.throws(()=>x.run('telao',action,{group:'G01',ids:['ticket-1']}));
 assert.throws(()=>x.run('telao','call',{group:'G02'}),/G01/);
 x.run('geral','pause');assert.throws(()=>x.run('telao','call',{group:'G01'}),/pausad/);
});
test('legacy state is displayed without writes and occupied slot cannot be overwritten',()=>{
 const x=setup();enter(x,'G01',0);delete x.s.groups[0].circuitSlot;const before=JSON.stringify(x.db);assert.equal(ops.circuitSlots(x.s)[0].id,'G01');assert.equal(JSON.stringify(x.db),before);
 x.run('apoio','safe',{group:'G01'});assert.throws(()=>x.run('telao','call',{group:'G02',slot:0}),/vaga foi ocupada/);assert.equal(x.s.groups[1].status,'closed');
 x.run('telao','call',{group:'G02',slot:2});assert.equal(x.s.groups[0].circuitSlot,0);
});
test('operator receives aggregate pending data, never names, tickets, contacts or support names',()=>{
 const x=setup();x.s.groups[0].guide='Nome privado apoio';x.s.people[0].paperAt=null;
 const before=JSON.stringify(x.db),out=live.project(x.db,'telao'),json=JSON.stringify(out);
 assert.equal(out.sessions[day].groups[0].paperPending,1);for(const value of ['Pessoa 1','ticket-1','Nome privado apoio'])assert.ok(!json.includes(value));assert.equal(JSON.stringify(x.db),before);
});

const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
function apiFixture(){
 const source=fs.readFileSync(path.join(__dirname,'../pages/api/operacao/index.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
 const state={session:setup().s,revision:0,logs:new Map(),writes:0};let serial=Promise.resolve();
 const query=async(sql,args=[])=>{
  if(sql.startsWith('SELECT state'))return {rows:[{state:structuredClone(state.session),revision:state.revision}]};
  if(sql.startsWith('SELECT payload_hash'))return {rows:state.logs.has(args[2])?[state.logs.get(args[2])]:[]};
  if(sql.startsWith('UPDATE peniel_ops.session_state')){state.session=JSON.parse(args[1]);state.revision=args[2];state.writes++;return {rows:[]};}
  if(sql.startsWith('INSERT INTO peniel_ops.command_log')){state.logs.set(args[2],{payload_hash:args[3],message:args[5]});return {rows:[]};}
  throw Error('Unexpected query');
 };
 const handler=new Function('createHash','query','transaction','actor','fail','sameOrigin','ops','live',source)(createHash,query,fn=>{const job=serial.then(()=>fn({query}));serial=job.catch(()=>{});return job;},async req=>({user_id:'test-'+req.testRole,role:req.testRole}),(status,message)=>Object.assign(Error(message),{status}),()=>{},ops,live);
 async function call(revision,requestId,role='telao'){
  const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.code||=200;this.body=body;return this;}};
  await handler({method:'POST',headers:{},testRole:role,body:{session:day,role,action:'call',arg:{group:'G01',slot:0},revision,requestId}},res);return res;
 }
 return {state,call};
}

test('two operators calling simultaneously reserve one slot once; retry is idempotent',async()=>{
 const f=apiFixture(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 const results=await Promise.all([f.call(0,a),f.call(0,b)]);
 assert.deepEqual(results.map(r=>r.code).sort(),[200,409]);assert.equal(f.state.writes,1);assert.equal(ops.occupied(f.state.session).length,1);
 assert.equal((await f.call(0,a)).code,200);assert.equal(f.state.writes,1);
 assert.equal((await f.call(1,b)).code,422);assert.equal(f.state.writes,1);
});
const Module=require('node:module'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('next/dist/build/swc');
function panels(){const filename=path.resolve(__dirname,'../components/CircuitPanels.jsx'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(transformSync(fs.readFileSync(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code,filename);return m.exports;}
test('operator renders exactly three cards and finished groups leave them without leaking participant names',()=>{
 const x=setup();enter(x,'G01',0);x.run('apoio','safe',{group:'G01'});const {CircuitOperator}=panels();
 const render=()=>renderToStaticMarkup(React.createElement(CircuitOperator,{session:live.project(x.db,'telao').sessions[day],disabled:false,confirm(){},publicHref:'/operacao/telao?exibir=1'}));
 let html=render();assert.equal((html.match(/class="op-circuit-slot /g)||[]).length,3);assert.equal((html.match(/op-circuit-slot is-empty/g)||[]).length,2);assert.doesNotMatch(html,/Pessoa 1|ticket-1/);assert.match(html,/Abrir projeção/);
 x.run('apoio','finish',{group:'G01'});html=render();assert.equal((html.match(/op-circuit-slot is-empty/g)||[]).length,3);assert.match(html,/Grupos finalizados/);
});
