const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs'),capacity=require('../lib/admission-capacity.cjs'),tickets=require('../lib/entry-tickets.cjs');
const day='2026-11-21',at=day+'T21:00:00Z';
function fixture({now=at}={}){
 const state=ops.freshSession(day);state.groups[3].capacityOverride=36;state.groups[7].capacityOverride=39;
 state.caravans=[['G01',17],['G01',16],['G03',35],['G04',36],['G07',7],['G08',27],['G08',12]].map(([group,count],index)=>({id:randomUUID(),name:'Caravana '+index,city:'Cidade',responsible:'Responsável',contact:'',group,authorization:{status:'authorized'},members:Array.from({length:count},(_,i)=>({code:'CAR-'+randomUUID(),name:'Pessoa '+index+' '+i,phone:''}))}));
 const row={state,revision:20},logs=new Map();let serial=Promise.resolve(),writes=0;
 const query=async(sql,args=[])=>{
  if(sql.startsWith('SELECT state'))return {rows:[structuredClone(row)]};
  if(sql.startsWith('SELECT payload_hash'))return {rows:logs.has(args[1]+':'+args[2])?[logs.get(args[1]+':'+args[2])]:[]};
  if(sql.includes('count(*)'))return {rows:[{total:0}]};
  if(sql.startsWith('UPDATE peniel_ops.session_state')){row.state=JSON.parse(args[1]);row.revision=args[2];writes++;return {rows:[]};}
  if(sql.startsWith('INSERT INTO peniel_ops.command_log')){logs.set(args[1]+':'+args[2],{payload_hash:args[3],message:args[5]});return {rows:[]};}
  throw Error(sql);
 };
 const transaction=fn=>{const job=serial.then(()=>fn({query}));serial=job.catch(()=>{});return job;};
 const source=fs.readFileSync(path.join(__dirname,'../pages/api/operacao/index.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
 const clocked={...live,command:(db,session,role,action,arg)=>live.command(db,session,role,action,arg,now),caravanGateView:(db,session)=>live.caravanGateView(db,session,now)};
 const handler=new Function('createHash','query','transaction','actor','fail','sameOrigin','ops','live','capacity','tickets','console',source)(createHash,query,transaction,async req=>({role:req.userRole,user_id:req.userId}),(status,message)=>Object.assign(Error(message),{status}),()=>{},ops,clocked,capacity,tickets,{warn(){},error(){}});
 async function call({code,action='caravanAdmit',arg,role='portaria',actor=role,revision=20,requestId=randomUUID()}={}){
  const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;this.code||=200;}};
  await handler({method:'POST',userRole:role,userId:actor,body:{session:day,role,action,arg:arg||{code},revision,requestId}},res);return res;
 }
 return {row,logs,call,get writes(){return writes},codes:state.caravans.flatMap(c=>c.members.map(m=>m.code))};
}

test('150 native admissions from four gates accept an old shared revision without false session conflicts or automatic group assignment',async()=>{
 const f=fixture(),before=structuredClone(f.row.state.groups);
 const results=await Promise.all(f.codes.map((code,i)=>f.call({code,actor:'gate-'+i%4})));
 assert.ok(results.every(r=>r.code===200),JSON.stringify(results.filter(r=>r.code!==200).map(r=>r.body)));
 assert.equal(f.writes,150);assert.equal(f.row.state.people.length,150);assert.equal(new Set(f.row.state.people.map(p=>p.id)).size,150);assert.ok(f.row.state.people.every(p=>p.group===null&&p.paperAt===null));assert.deepEqual(f.row.state.groups,before);
 assert.ok(results.every((r,i)=>r.body.db===undefined&&r.body.caravanGate.members.find(m=>m.code===f.codes[i]).admitted));
});
test('a gate admission revalidates after unrelated coordination assignment and paper delivery',async()=>{
 const f=fixture();assert.equal((await f.call({code:f.codes[0]})).code,200);
 assert.equal((await f.call({role:'coordenacao',action:'assign',arg:{ids:[f.codes[0]],group:'G01'}})).code,200);
 assert.equal((await f.call({role:'coordenacao',action:'deliver',arg:{ids:[f.codes[0]],expectedGroup:'G01'}})).code,200);
 assert.equal((await f.call({code:f.codes[1]})).code,200);assert.equal(f.row.state.people.length,2);assert.ok(f.row.state.people[0].paperAt);assert.equal(f.row.state.people[1].group,null);
});
test('replaying the exact native command after a lost response returns confirmation without another arrival or write',async()=>{
 const f=fixture(),command={code:f.codes[0],requestId:randomUUID(),actor:'gate-a'};
 const first=await f.call(command),second=await f.call(command);assert.equal(first.code,200);assert.equal(second.code,200);assert.equal(f.writes,1);assert.equal(f.row.state.people.length,1);assert.equal(second.body.caravanGate.members.find(m=>m.code===command.code).admitted,true);
});
test('two gates cannot register the same native member twice even when they use different request identifiers',async()=>{
 const f=fixture(),results=await Promise.all([f.call({code:f.codes[0],actor:'gate-a'}),f.call({code:f.codes[0],actor:'gate-b'})]);assert.deepEqual(results.map(r=>r.code).sort(),[200,422]);assert.match(results[1].body.error,/já entrou/);assert.equal(f.writes,1);
});
test('revalidation keeps payment, day, role and capacity checks in force',async()=>{
 const f=fixture();f.row.revision=99;f.row.state.caravans[0].authorization=null;
 assert.equal((await f.call({code:f.codes[0]})).code,422);assert.equal((await f.call({code:f.codes[34],role:'coordenacao'})).code,422);assert.equal(f.writes,0);
 assert.equal(ops.canRevalidate('caravanAdmit',{code:'12345678'}),false);assert.equal(ops.canRevalidate('caravanAdmit',{}),false);assert.equal(ops.canRevalidate('pause',{}),false);
 const wrongDay=fixture({now:'2026-11-22T21:00:00Z'});assert.equal((await wrongDay.call({code:wrongDay.codes[0]})).code,422);assert.equal(wrongDay.writes,0);
 const full=fixture();full.row.state.people=Array.from({length:750},(_,i)=>({id:'occupied-'+i,name:'Pessoa já admitida',group:null,paperAt:null}));assert.equal((await full.call({code:full.codes[0]})).code,409);assert.equal(full.writes,0);
});
