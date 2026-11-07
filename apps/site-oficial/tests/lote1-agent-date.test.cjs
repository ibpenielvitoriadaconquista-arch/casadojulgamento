const test=require('node:test'),assert=require('node:assert/strict');
const qa=require('../lib/assistant-homologation.cjs'),rules=require('../lib/official-entries.cjs');
const CODE='99000001',SESSION=rules.LOT.session,USER={role:'geral',user_id:'homologacao-isolada'};
test('gestor chat authorizes all six official entry dates into Lote 1 after October; Portaria performs one real transport call',async()=>{
 for(const entry of rules.ENTRIES.slice(1)){
  const f=qa.fixture({entry});f.state.now='2026-11-07T18:00:00.000Z';
  const before=await f.service.lookup(CODE,SESSION);assert.equal(before.needsDateAuthorization,true);assert.equal(before.eligible,false);
  const p=await f.prepare('date');assert.equal(p.target,SESSION);assert.equal(f.state.upstreamSends,0);
  assert.equal((await f.confirm(p)).status,'authorized');assert.equal(f.state.upstreamSends,0);assert.equal(f.state.session.people.length,0);
  assert.equal(f.state.audit[0].evidence.day,'2026-11-07');assert.equal((await f.service.lookup(CODE,SESSION)).eligible,true);
  const r=await Promise.allSettled([f.service.admit(CODE,SESSION,USER),f.service.admit(CODE,SESSION,USER)]);
  assert.equal(r.filter(x=>x.status==='fulfilled'&&x.value.admitted).length,1);assert.equal(f.state.upstreamSends,1);assert.equal(f.state.session.people.length,1);
 }
});
test('Lote 1 exception still refuses cancellation, revoked tickets, used tickets and full session',async()=>{
 for(const settings of [{confirmed:false},{revoked:true},{used:true},{occupied:300}]){const f=qa.fixture({entry:rules.ENTRIES[3],...settings});f.state.now='2026-11-07T18:00:00.000Z';await assert.rejects(f.prepare('date'));assert.equal(f.state.upstreamSends,0);assert.equal(f.state.audit.length,0);}
});
test('training authorization expires on the following day without opening official sessions',async()=>{
 const f=qa.fixture({entry:rules.ENTRIES[3]});f.state.now='2026-11-07T18:00:00.000Z';await f.confirm(await f.prepare('date'));f.state.now='2026-11-08T18:00:00.000Z';assert.equal((await f.service.lookup(CODE,SESSION)).eligible,false);await assert.rejects(f.service.admit(CODE,SESSION,USER));assert.equal(f.state.upstreamSends,0);
 for(const entry of rules.ENTRIES.slice(1))assert.equal(rules.sessionOpen(entry,'2026-11-07'),false);
});
test('non-manager cannot grant a Lote 1 date exception',async()=>{
 const f=qa.fixture({entry:rules.ENTRIES[3]});f.state.now='2026-11-07T18:00:00.000Z';await assert.rejects(f.authorization.execute({role:'coordenacao',user_id:'coord'},{action:'authorize_date',code:CODE,session:SESSION,paymentStatus:'paid',evidence:'Inscrição de teste conferida',confirmed:true}),e=>e.status===403);assert.equal(f.state.audit.length,0);
});
