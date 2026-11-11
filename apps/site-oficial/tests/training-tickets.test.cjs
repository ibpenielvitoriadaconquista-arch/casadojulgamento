const test=require('node:test'),assert=require('node:assert/strict');
const training=require('../lib/training-tickets.cjs'),ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs');
const session=training.SESSION,code='CDJTESTE-0511-001',now='2026-11-05T18:00:00Z';
function fixture(day='2026-11-05'){
 let state=ops.freshSession(session);state.trainingTickets=[{code,name:'Alice Teste',enabled:true,paymentStatus:'simulated_confirmed',day}];let revision=0,tail=Promise.resolve();
 const query=async(sql,args)=>{if(sql.startsWith('SELECT'))return {rows:[{state:structuredClone(state),revision}]};if(sql.startsWith('UPDATE')){state=JSON.parse(args[1]);revision=args[2];return {rows:[]};}throw Error('Unexpected query');};
 const transaction=fn=>{const run=tail.then(()=>fn({query}));tail=run.catch(()=>{});return run;};
 return {service:training.createService({query,transaction,now:()=>now}),state:()=>state,set:s=>{state=s;}};
}
test('training namespace never accepts real ticket numbers or arbitrary values',()=>{assert.equal(training.parse(code),code);for(const value of ['77772709','CDJTESTE-0511-00','https://example.com/'+code,null])assert.equal(training.parse(value),null);});
test('training lookup is limited to Lote 1, explicitly enabled roster and today',async()=>{
 const f=fixture();assert.equal((await f.service.lookup(code,session)).eligible,true);await assert.rejects(f.service.lookup(code,'2026-11-09'),/somente/);await assert.rejects(f.service.lookup('CDJTESTE-0511-999',session),/cadastrado/);
 assert.equal((await fixture('2026-11-04').service.lookup(code,session)).eligible,false);
 const s=f.state();s.trainingTickets[0].enabled=false;f.set(s);assert.equal((await f.service.lookup(code,session)).eligible,false);
});
test('arrival stores one test person in coordination without an Even3 dependency',async()=>{
 const f=fixture(),r=await f.service.admit(code,session,{role:'portaria',user_id:'operator'});assert.equal(r.admitted,true);assert.equal(r.training,true);assert.equal(r.even3Confirmed,undefined);
 const p=f.state().people[0];assert.equal(p.name,'Alice Teste');assert.equal(p.group,null);assert.equal(p.training,true);assert.equal(p.admittedBy,'operator');assert.equal(f.state().trainingTickets[0].usedBy,'operator');
 assert.equal((await f.service.lookup(code,session)).checkedIn,true);await assert.rejects(f.service.admit(code,session,{role:'portaria',user_id:'operator'}),/já utilizado/);
});
test('simultaneous operators cannot admit the same fictitious code twice',async()=>{const f=fixture();const results=await Promise.allSettled(['a','b'].map(user_id=>f.service.admit(code,session,{role:'portaria',user_id})));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.state().people.length,1);});
test('cashier and other roles cannot use test codes to admit; consumed codes survive a cleared queue',async()=>{const f=fixture();for(const role of ['caixa','caravanas','coordenacao','guias'])await assert.rejects(f.service.admit(code,session,{role,user_id:role}),/Somente/);await f.service.admit(code,session,{role:'geral',user_id:'manager'});const s=f.state();s.people=[];f.set(s);await assert.rejects(f.service.admit(code,session,{role:'geral',user_id:'manager'}),/já utilizado/);const projected=live.project({sessions:{[session]:s}},'portaria');assert.equal(projected.sessions[session].trainingTickets,undefined);});

test('mobile copies normalize lowercase, spaces, compact tokens and typographic hyphens without accepting real numbers',()=>{
 for(const value of ['cdjteste-0511-001',' CDJTESTE - 0511 - 001 ','CDJTESTE–0511–001','CDJTESTE0511001','`CDJTESTE-0511-001`'])assert.equal(training.parse(value),code);
 for(const value of ['0511001','12345678','https://example.com/CDJTESTE-0511-001','CDJTESTE-0511-001-extra'])assert.equal(training.parse(value),null);
});

test('200 CJ tickets traverse all posts with unique admissions and manual groups, isolated by date',async()=>{
 const day=training.TEAM_SESSION,at='2026-11-11T21:00:00Z';
 let state=ops.freshSession(day),revision=1,tail=Promise.resolve();
 state.trainingTickets=Array.from({length:200},(_,i)=>({code:'CJ-'+String(i+1).padStart(3,'0'),name:'Treinamento '+String(i+1).padStart(3,'0'),enabled:true,paymentStatus:'simulated_confirmed',day}));
 const query=async(sql,args)=>{assert.equal(args[0],day,'never touch another session');if(sql.startsWith('SELECT'))return {rows:[{state:structuredClone(state),revision}]};if(sql.startsWith('UPDATE')){state=JSON.parse(args[1]);revision=args[2];return {rows:[]};}throw Error(sql);};
 const transaction=fn=>{const run=tail.then(()=>fn({query}));tail=run.catch(()=>{});return run;};
 const service=training.createService({query,transaction,now:()=>at});
 assert.equal(training.parse(' cj–001 '),'CJ-001');
 for(const other of ['2026-10-22','2026-11-13','2026-11-14'])await assert.rejects(service.lookup('CJ-001',other),/somente/);
 for(const code of ['CJ-000','CJ-201'])await assert.rejects(service.lookup(code,day),/cadastrado/);
 const results=await Promise.allSettled(['a','b'].map(user_id=>service.admit('CJ-001',day,{role:'portaria',user_id})));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 await Promise.all(Array.from({length:199},(_,i)=>service.admit('CJ-'+String(i+2).padStart(3,'0'),day,{role:'portaria',user_id:'gate-'+i%4})));
 assert.equal(state.people.length,200);assert.ok(state.people.every(p=>p.group===null));
 assert.equal(state.groups.length,6);assert.ok(state.groups.every(g=>g.members.length===0));
 await assert.rejects(service.admit('CJ-200',day,{role:'portaria',user_id:'a'}),/já utilizado/);
 let db={schema:5,revision,sessions:{[day]:state}};
 const cmd=(role,action,arg)=>{db=live.command(db,day,role,action,arg,at).db;};
 assert.throws(()=>cmd('portaria','assign',{ids:['CJ-001'],group:'G01'}),/outro posto/);
 for(let i=0;i<6;i++){
  const group='G0'+(i+1),ids=state.people.slice(i*35,(i+1)*35).map(p=>p.id);
  cmd('coordenacao','assign',{ids,group});cmd('coordenacao','deliver',{ids});cmd('telao','close',{group});
  cmd('telao','call',{group});cmd('apoio','arrive',{group});cmd('apoio','start',{group,physicallySafe:true});cmd('apoio','safe',{group});cmd('apoio','finish',{group});
 }
 assert.deepEqual(db.sessions[day].groups.map(g=>g.members.length),[35,35,35,35,35,25]);assert.ok(db.sessions[day].groups.every(g=>g.status==='finished'));
 assert.equal(live.project(db,'portaria').sessions[day].trainingTickets,undefined);
 assert.equal(training.inspect(state,'CJ-001',day,'2026-11-12T21:00:00Z').eligible,false);
});

test('gate API refuses real numbers in team training before any Even3 call',async()=>{
 const fs=require('node:fs'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'../pages/api/operacao/ingresso.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
 let calls=0;const fail=(status,message)=>Object.assign(Error(message),{status});
 const handler=new Function('actor','fail','sameOrigin','query','transaction','tickets','admission','even3','training',source)(async()=>({role:'portaria'}),fail,()=>{},()=>{},()=>{},{parseTicketCode:x=>x},{createService:()=>({lookup:async()=>{calls++;},admit:async()=>{calls++;}})},{},training);
 for(const action of ['lookup','admit']){let status=200,body;const res={setHeader(){},status(n){status=n;return this;},json(b){body=b;return this;}};await handler({method:'POST',body:{session:training.TEAM_SESSION,code:'77772709',action}},res);assert.equal(status,400);assert.match(body.error,/fictícios/);}
 assert.equal(calls,0);
});

test('CJ-000 can repeat only in team training and produces distinct unassigned people',async()=>{
 const day=training.TEAM_SESSION,at='2026-11-11T23:00:00Z';let state=ops.freshSession(day),revision=1,tail=Promise.resolve();
 state.trainingTickets=[{code:'CJ-000',name:'Demonstração',day,enabled:true,reusable:true,paymentStatus:'simulated_confirmed'},{code:'CJ-001',name:'Pessoa 001',day,enabled:true,reusable:true,paymentStatus:'simulated_confirmed'}];
 const query=async(sql,args)=>{assert.equal(args[0],day);if(sql.startsWith('SELECT'))return {rows:[{state:structuredClone(state),revision}]};state=JSON.parse(args[1]);revision=args[2];return {rows:[]};};
 const transaction=fn=>{const run=tail.then(()=>fn({query}));tail=run.catch(()=>{});return run;};
 const service=training.createService({query,transaction,now:()=>at}),user={role:'portaria',user_id:'test'};
 await Promise.all([service.admit('CJ-000',day,user),service.admit('CJ-000',day,user)]);
 assert.equal(state.people.length,2);assert.equal(new Set(state.people.map(p=>p.id)).size,2);assert.ok(state.people.every(p=>p.group===null));
 assert.equal((await service.lookup('CJ-000',day)).eligible,true);assert.equal(state.trainingTickets[0].usedAt,undefined);
 await service.admit('CJ-001',day,user);await assert.rejects(service.admit('CJ-001',day,user),/já utilizado/);
 await assert.rejects(service.admit('CJ-000','2026-11-13',user),/somente/);
 assert.equal(training.inspect(state,'CJ-000',day,'2026-11-12T23:00:00Z').eligible,false);
 state.closedAt=at;assert.equal((await service.lookup('CJ-000',day)).eligible,false);
});
