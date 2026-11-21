const test=require('node:test'),assert=require('node:assert/strict');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs');
const day='2026-11-13';
function setup(){let db=ops.fresh();db.sessions[day].caravanReleased=['G04'];let clock=Date.parse('2026-11-13T22:00:00Z');const run=(role,action,arg={})=>{db=live.command(db,day,role,action,arg,new Date(clock+=1000).toISOString()).db;};for(let i=1;i<=4;i++){const id='ticket-'+i,group='G0'+i;db=live.admit(db,day,{verified:true,participantId:id,registrationId:id,entryId:'entry',name:'Pessoa '+i}).db;run('coordenacao','assign',{ids:[id],group});run('coordenacao','deliver',{ids:[id]});run('telao','close',{group});}return {get db(){return db},get s(){return db.sessions[day]},run};}
function enter(x,group,slot){x.run('telao','call',{group,slot});x.run('apoio','arrive',{group});x.run('apoio','start',{group,physicallySafe:true});}
test('three reserved slots include calls, remain stable, and release only the finished group',()=>{
 const x=setup();enter(x,'G01',2);x.run('telao','call',{group:'G02',slot:0});x.run('apoio','arrive',{group:'G02'});assert.throws(()=>x.run('apoio','start',{group:'G02',physicallySafe:true}),/ponto seguro/);x.run('apoio','safe',{group:'G01'});
 x.run('apoio','start',{group:'G02',physicallySafe:true});x.run('apoio','safe',{group:'G02'});x.run('telao','call',{group:'G03',slot:1});
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
function apiFixture(rehearsal=false){
 const source=fs.readFileSync(path.join(__dirname,'../pages/api/operacao/'+(rehearsal?'ensaio.js':'index.js')),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
 const state={session:setup().s,revision:0,logs:new Map(),writes:0};let serial=Promise.resolve();
 const query=async(sql,args=[])=>{
  if(sql.startsWith('SELECT state'))return {rows:[{state:structuredClone(state.session),revision:state.revision}]};
  if(sql.startsWith('SELECT payload_hash'))return {rows:state.logs.has(args[2])?[state.logs.get(args[2])]:[]};
  if(sql.startsWith('UPDATE peniel_ops.')&&sql.includes('session_state')){state.session=JSON.parse(args[1]);state.revision=args[2];state.writes++;return {rows:[]};}
  if(sql.startsWith('INSERT INTO peniel_ops.')&&sql.includes('command_log')){state.logs.set(args[2],{payload_hash:args[3],message:args[5]});return {rows:[]};}
  throw Error('Unexpected query');
 };
 const handler=new Function('createHash','query','transaction','actor','fail','sameOrigin','ops','live',source)(createHash,query,fn=>{const job=serial.then(()=>fn({query}));serial=job.catch(()=>{});return job;},async req=>({user_id:'test-'+req.testRole,role:req.testRole}),(status,message)=>Object.assign(Error(message),{status}),()=>{},ops,live);
 async function call(revision,requestId,role='telao',action='call',arg={group:'G01',slot:0}){
  const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.code||=200;this.body=body;return this;}};
  await handler({method:'POST',headers:{},testRole:role,body:{session:day,role,action,arg,revision,requestId}},res);return res;
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

function projectedVersion(f,role,id){
 return live.project({schema:5,revision:f.state.revision,sessions:{[day]:f.state.session}},role).sessions[day].groups.find(g=>g.id===id).commandVersion;
}
for(const rehearsal of [false,true]){
 const label=rehearsal?'Ensaio':'Operação real';
 for(const [action,status,role] of [
  ['close','forming','telao'],['reopen','closed','telao'],['call','closed','telao'],
  ['arrive','called','apoio'],['start','waiting','apoio'],['safe','circuit','apoio'],['finish','safe','apoio']
 ])test(label+': '+action+' tolera chegada na Portaria e atualização de outro grupo',async()=>{
  const f=apiFixture(rehearsal);f.state.session.groups[0].status=status;
  const expectedGroupVersion=projectedVersion(f,role,'G01');
  f.state.session.people.push({id:'chegada-nova',name:'Chegada nova',group:null,paperAt:null});
  f.state.session.groups[3].guide='Outro apoio';f.state.revision=50;
  const out=await f.call(0,'11111111-1111-4111-8111-111111111111',role,action,{group:'G01',slot:0,physicallySafe:true,expectedGroupVersion});
  assert.equal(out.code,200,JSON.stringify(out.body));assert.equal(f.state.writes,1);assert.equal(f.state.revision,51);
  assert.equal(f.state.session.people.at(-1).group,null);assert.equal(f.state.session.groups[3].guide,'Outro apoio');
 });
 test(label+': alteração no próprio grupo exige conferência e devolve painel atualizado, sem fechar grupo com senha pendente',async()=>{
  const f=apiFixture(rehearsal);f.state.session.groups[0].status='forming';
  const expectedGroupVersion=projectedVersion(f,'telao','G01');
  f.state.session.people[0].paperAt=null;f.state.revision=50;
  const out=await f.call(0,'11111111-1111-4111-8111-111111111111','telao','close',{group:'G01',expectedGroupVersion});
  assert.equal(out.code,409);assert.equal(f.state.writes,0);assert.match(out.body.error,/G01 foi alterado/);
  assert.equal(out.body.db.revision,50);assert.equal(out.body.db.sessions[day].groups[0].paperPending,1);
  assert.notEqual(out.body.db.sessions[day].groups[0].commandVersion,expectedGroupVersion);
  assert.equal(f.state.session.groups[0].status,'forming');
 });
 test(label+': dois operadores fecham grupos diferentes; fechar o mesmo grupo duas vezes é impedido',async()=>{
  const f=apiFixture(rehearsal);f.state.session.groups[0].status='forming';f.state.session.groups[1].status='forming';f.state.revision=10;
  const a={group:'G01',expectedGroupVersion:projectedVersion(f,'telao','G01')},b={group:'G02',expectedGroupVersion:projectedVersion(f,'telao','G02')};
  const results=await Promise.all([
   f.call(10,'11111111-1111-4111-8111-111111111111','telao','close',a),
   f.call(10,'22222222-2222-4222-8222-222222222222','telao','close',b),
   f.call(10,'33333333-3333-4333-8333-333333333333','telao','close',a)
  ]);
  assert.deepEqual(results.map(r=>r.code),[200,200,409]);assert.equal(f.state.writes,2);assert.equal(f.state.revision,12);
  assert.equal((await f.call(10,'11111111-1111-4111-8111-111111111111','telao','close',a)).code,200);assert.equal(f.state.writes,2);
 });
}
const Module=require('node:module'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('next/dist/build/swc');
function panels(react=React){const filename=path.resolve(__dirname,'../components/CircuitPanels.jsx'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m.require=id=>id==='react'?react:Module.prototype.require.call(m,id);m._compile(transformSync(fs.readFileSync(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code,filename);return m.exports;}
test('operator renders exactly three cards and finished groups leave them without leaking participant names',()=>{
 const x=setup();enter(x,'G01',0);x.run('apoio','safe',{group:'G01'});const {CircuitOperator}=panels();
 const render=()=>renderToStaticMarkup(React.createElement(CircuitOperator,{session:live.project(x.db,'telao').sessions[day],disabled:false,confirm(){},publicHref:'/operacao/telao?exibir=1'}));
 let html=render();assert.equal((html.match(/class="op-circuit-slot /g)||[]).length,3);assert.equal((html.match(/op-circuit-slot is-empty/g)||[]).length,2);assert.doesNotMatch(html,/Pessoa 1|ticket-1/);assert.match(html,/Abrir projeção/);
 x.run('apoio','finish',{group:'G01'});html=render();assert.equal((html.match(/op-circuit-slot is-empty/g)||[]).length,3);assert.match(html,/Grupos finalizados/);
});

test('November 14 can reserve the fourth slot; a fifth call waits for a finish',()=>{
 const day14='2026-11-14',db=ops.fresh(),s=db.sessions[day14];
 for(let i=0;i<5;i++){
  const g=s.groups[i], id='p'+i;
  g.status=i<3?'safe':'closed';g.members=[id];
  s.people.push({id,group:g.id,paperAt:'confirmed'});
 }
 assert.equal(ops.circuitSlots(s,day).length,3);
 assert.equal(ops.circuitSlots(s,day14).length,4);
 const next=live.command(db,day14,'telao','call',{group:'G04',slot:3}).db;
 assert.equal(ops.circuitSlots(next.sessions[day14],day14)[3].id,'G04');
 assert.throws(()=>live.command(next,day14,'telao','call',{group:'G05'}),/quatro vagas/);
});

function unorderedSetup(){
 const day19='2026-11-19';let db=ops.fresh();let clock=Date.parse('2026-11-19T22:00:00Z');
 const s=db.sessions[day19];
 for(let i=0;i<6;i++){
  const g=s.groups[i],id='out-of-order-'+i;g.members=[id];g.status=i===1?'forming':'closed';
  s.people.push({id,name:'Pessoa de teste '+i,group:g.id,paperAt:i===1?null:'entregue'});
 }
 const run=(role,action,arg)=>{db=live.command(db,day19,role,action,arg,new Date(clock+=1000).toISOString()).db;};
 return {get db(){return db},get s(){return db.sessions[day19]},run,day:day19};
}
test('November 19 can call G04, G03, G01, G02 out of numerical order; four occupied cards block only the fifth call',()=>{
 const x=unorderedSetup();
 assert.equal(ops.circuitLimitFor(x.day),4);
 for(const [id,slot] of [['G04',3],['G03',0],['G01',1],['G02',2]]){
  if(id==='G02')x.run('coordenacao','deliver',{ids:x.s.groups[1].members,expectedGroup:'G02'});
  if(id==='G02')x.run('telao','close',{group:id});
  x.run('telao','call',{group:id,slot});
  assert.equal(ops.circuitSlots(x.s,x.day)[slot].id,id);
  x.run('apoio','arrive',{group:id});x.run('apoio','start',{group:id,physicallySafe:true});x.run('apoio','safe',{group:id});
 }
 assert.equal(x.s.groups[4].status,'closed');assert.equal(ops.occupied(x.s).length,4);
 const before=JSON.stringify(x.db);
 assert.throws(()=>x.run('telao','call',{group:'G06',slot:3}),/quatro vagas/);
 assert.equal(JSON.stringify(x.db),before);
 x.run('apoio','finish',{group:'G04'});assert.equal(ops.circuitSlots(x.s,x.day)[3],null);
 x.run('telao','call',{group:'G06',slot:3});
 assert.deepEqual(ops.circuitSlots(x.s,x.day).map(g=>g.id),['G03','G01','G02','G06']);
 assert.equal(x.s.groups[4].status,'closed');assert.equal(x.s.people.length,6);
});
test('nonsequential calls keep paper delivery, waiting-area, safe-point and pause checks',()=>{
 const x=unorderedSetup();
 assert.throws(()=>x.run('telao','close',{group:'G02'}),/senhas/);
 x.run('telao','call',{group:'G04',slot:0});
 assert.throws(()=>x.run('telao','call',{group:'G03',slot:1}),/sala de espera/);
 x.run('apoio','arrive',{group:'G04'});x.run('apoio','start',{group:'G04',physicallySafe:true});
 x.run('telao','call',{group:'G03',slot:1});x.run('apoio','arrive',{group:'G03'});
 assert.throws(()=>x.run('apoio','start',{group:'G03',physicallySafe:true}),/ponto seguro/);
 x.run('apoio','safe',{group:'G04'});
 assert.throws(()=>x.run('apoio','start',{group:'G03'}),/segurança/);
 x.run('geral','pause');assert.throws(()=>x.run('apoio','start',{group:'G03',physicallySafe:true}),/pausad/);
 x.run('geral','pause');x.run('apoio','start',{group:'G03',physicallySafe:true});
 assert.equal(x.s.groups[1].status,'forming');assert.equal(x.s.groups[2].status,'circuit');
});
test('November 19 renders four selectable cards with G03 ready while G02 is still forming',()=>{
 const x=unorderedSetup();x.s.groups[0].status='finished';x.s.groups[3].caravanDeferred=true;
 const before=JSON.stringify(x.db),{CircuitOperator}=panels();
 const html=renderToStaticMarkup(React.createElement(CircuitOperator,{session:live.project(x.db,'telao').sessions[x.day],day:x.day,disabled:false,confirm(){},publicHref:'/operacao/telao?sessao='+x.day}));
 assert.equal((html.match(/class="op-circuit-slot /g)||[]).length,4);
 const cards=html.match(/<article class="op-circuit-slot is-empty">.*?<\/article>/g);
 assert.equal(cards.length,4);
 for(const card of cards){
  assert.match(card,/<select id="op-slot-group-[0-3]"/);assert.match(card,/<option value="G03" selected=""/);
  assert.doesNotMatch(card,/<option value="G02"|<option value="G04"/);
  assert.match(card,/<button class="op-btn gold">\+ Chamar grupo · G03<\/button>/);
 }
 assert.equal(ops.nextToCall(x.s).id,'G03');assert.equal(JSON.stringify(x.db),before);
});
test('the fourth card sends the group explicitly chosen by the operator rather than the first closed group',()=>{
 const x=unorderedSetup(),commands=[];
 const {CircuitOperator}=panels({...React,useState:initial=>[typeof initial==='string'?'':{3:'G06'},()=>{}]});
 const tree=CircuitOperator({session:live.project(x.db,'telao').sessions[x.day],day:x.day,disabled:false,confirm:(message,action,arg)=>commands.push({action,arg}),publicHref:'/operacao/telao'});
 function elements(node,predicate){
  if(!node)return [];
  if(Array.isArray(node))return node.flatMap(child=>elements(child,predicate));
  return [...(predicate(node)?[node]:[]),...elements(node.props?.children,predicate)];
 }
 const cards=elements(tree,node=>node.type==='article'&&node.props.className==='op-circuit-slot is-empty');
 const select=elements(cards[3],node=>node.type==='select')[0];
 assert.equal(select.props.value,'G06');
 const button=elements(cards[3],node=>node.type==='button')[0];assert.equal(button.props.disabled,false);
 button.props.onClick();assert.deepEqual(commands,[{action:'call',arg:{group:'G06',slot:3}}]);
 assert.equal(x.s.groups[1].status,'forming');
});

function november20InProgress(){
 const day20='2026-11-20',db=ops.fresh(),s=db.sessions[day20];
 for(const [id,status,slot] of [['G01','safe',2],['G02','safe',0],['G03','safe',1],['G05','closed',null],['G08','closed',null]]){
  const g=s.groups.find(g=>g.id===id),pid='nov20-'+id;Object.assign(g,{status,members:[pid],calledAt:'2026-11-20T21:00:00Z',...(slot===null?{}:{circuitSlot:slot,safeAt:'2026-11-20T21:05:00Z'})});
  s.people.push({id:pid,name:'Nome privado '+id,group:id,paperAt:'2026-11-20T20:55:00Z',arrivedAt:'2026-11-20T20:50:00Z'});
 }
 return {db,day:day20};
}
test('November 20 adds a fourth slot without changing the three groups already in progress',()=>{
 const f=november20InProgress(),before=structuredClone(f.db),day20=f.day,s=f.db.sessions[day20],at='2026-11-20T22:00:00Z';
 assert.equal(ops.circuitLimitFor(day20),4);assert.deepEqual(ops.circuitSlots(s,day20).map(g=>g?.id||null),['G02','G03','G01',null]);assert.deepEqual(f.db,before);
 let next=live.command(f.db,day20,'telao','call',{group:'G05',slot:3},at).db;
 for(const id of ['G01','G02','G03'])assert.deepEqual(next.sessions[day20].groups.find(g=>g.id===id),s.groups.find(g=>g.id===id));
 assert.deepEqual(next.sessions[day20].people,s.people);assert.deepEqual(ops.circuitSlots(next.sessions[day20],day20).map(g=>g.id),['G02','G03','G01','G05']);
 assert.throws(()=>live.command(next,day20,'telao','call',{group:'G08'},at),/quatro vagas/);
 next=live.command(next,day20,'apoio','arrive',{group:'G05'},at).db;next=live.command(next,day20,'apoio','start',{group:'G05',physicallySafe:true},at).db;next=live.command(next,day20,'apoio','safe',{group:'G05'},at).db;next=live.command(next,day20,'apoio','finish',{group:'G02'},at).db;
 assert.deepEqual(ops.circuitSlots(next.sessions[day20],day20).map(g=>g?.id||null),[null,'G03','G01','G05']);
 const waiting=november20InProgress();waiting.db.sessions[day20].groups[0].status='called';assert.match(ops.callBlock(waiting.db.sessions[day20],day20),/sala de espera/);
 assert.equal(ops.circuitLimitFor('2026-11-13'),3);
});
test('November 20 Telão renders the existing occupied cards plus a fourth selectable card without writing state',()=>{
 const f=november20InProgress(),before=structuredClone(f.db),{CircuitOperator}=panels();
 const html=renderToStaticMarkup(React.createElement(CircuitOperator,{session:live.project(f.db,'telao').sessions[f.day],day:f.day,disabled:false,confirm(){},publicHref:'/operacao/telao?sessao='+f.day}));
 assert.equal((html.match(/class="op-circuit-slot /g)||[]).length,4);assert.equal((html.match(/op-circuit-slot is-empty/g)||[]).length,1);assert.match(html,/op-circuit-slots-four/);assert.match(html,/id="op-slot-group-3"/);assert.match(html,/\+ Chamar grupo · G05/);assert.doesNotMatch(html,/Nome privado|nov20-G/);assert.deepEqual(f.db,before);
});

function november21InProgress(){
 const f=november20InProgress(),day21='2026-11-21';f.db.sessions[day21]=structuredClone(f.db.sessions[f.day]);return {db:f.db,day:day21};
}
test('November 21 adds the fourth slot and permits an out-of-order G08 call while preserving the three occupied groups',()=>{
 const f=november21InProgress(),before=structuredClone(f.db),s=f.db.sessions[f.day],at='2026-11-21T22:00:00Z';
 assert.equal(ops.circuitLimitFor(f.day),4);assert.deepEqual(ops.circuitSlots(s,f.day).map(g=>g?.id||null),['G02','G03','G01',null]);assert.deepEqual(f.db,before);
 const version=live.groupVersion(s,'G08');
 let next=live.command(f.db,f.day,'telao','call',{group:'G08',slot:3,expectedGroupVersion:version},at).db;
 for(const id of ['G01','G02','G03'])assert.deepEqual(next.sessions[f.day].groups.find(g=>g.id===id),s.groups.find(g=>g.id===id));
 assert.deepEqual(next.sessions[f.day].people,s.people);assert.equal(next.sessions[f.day].groups[4].status,'closed');
 assert.deepEqual(ops.circuitSlots(next.sessions[f.day],f.day).map(g=>g.id),['G02','G03','G01','G08']);
 assert.throws(()=>live.command(next,f.day,'telao','call',{group:'G05'},at),/quatro vagas/);
 next=live.command(next,f.day,'apoio','arrive',{group:'G08'},at).db;next=live.command(next,f.day,'apoio','start',{group:'G08',physicallySafe:true},at).db;
 assert.throws(()=>live.command(next,f.day,'telao','call',{group:'G05'},at),/quatro vagas/);
 next=live.command(next,f.day,'apoio','safe',{group:'G08'},at).db;next=live.command(next,f.day,'apoio','finish',{group:'G02'},at).db;
 assert.deepEqual(ops.circuitSlots(next.sessions[f.day],f.day).map(g=>g?.id||null),[null,'G03','G01','G08']);
 next=live.command(next,f.day,'telao','call',{group:'G05',slot:0},at).db;assert.equal(next.sessions[f.day].groups[4].status,'called');
 assert.deepEqual(next.sessions['2026-11-20'],before.sessions['2026-11-20']);assert.equal(ops.circuitLimitFor('2026-11-13'),3);
});
test('November 21 Telão renders a fourth card with the selector and no participant identities or state mutation',()=>{
 const f=november21InProgress(),before=structuredClone(f.db),{CircuitOperator}=panels();
 const html=renderToStaticMarkup(React.createElement(CircuitOperator,{session:live.project(f.db,'telao').sessions[f.day],day:f.day,disabled:false,confirm(){},publicHref:'/operacao/telao?sessao='+f.day}));
 assert.equal((html.match(/class="op-circuit-slot /g)||[]).length,4);assert.equal((html.match(/op-circuit-slot is-empty/g)||[]).length,1);assert.match(html,/op-circuit-slots-four/);assert.match(html,/id="op-slot-group-3"/);assert.match(html,/value="G08"/);assert.doesNotMatch(html,/Nome privado|nov20-G/);assert.deepEqual(f.db,before);
});
