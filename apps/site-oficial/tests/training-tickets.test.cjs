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
