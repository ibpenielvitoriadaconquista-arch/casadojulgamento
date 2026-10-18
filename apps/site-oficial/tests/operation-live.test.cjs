const test=require('node:test'),assert=require('node:assert/strict');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs');
const day='2026-11-09';
const arrival={verified:true,participantId:'person-1',registrationId:'ticket-1',activityId:'activity-test',name:'Pessoa de homologação'};
test('chegada validada entra sem grupo e segundo checkin não duplica',()=>{
 const first=live.admit(ops.fresh(),day,arrival);assert.equal(first.db.sessions[day].people[0].group,null);
 const again=live.admit(first.db,day,arrival);assert.equal(again.duplicate,true);assert.equal(again.db.sessions[day].people.length,1);
 assert.throws(()=>live.admit(ops.fresh(),day,{...arrival,verified:false}));
});
test('fluxo completo e troca com recolhimento da senha',()=>{
 let db=live.admit(ops.fresh(),day,arrival).db;
 const run=(role,action,arg)=>{db=live.command(db,day,role,action,arg).db;};
 run('coordenacao','assign',{ids:['ticket-1'],group:'G01'});
 run('coordenacao','deliver',{ids:['ticket-1']});
 assert.throws(()=>run('coordenacao','move',{id:'ticket-1',group:'G02',reason:'família'}));
 run('coordenacao','move',{id:'ticket-1',group:'G02',reason:'família',paperReturned:true});
 assert.equal(db.sessions[day].people[0].paperAt,null);
 run('coordenacao','deliver',{ids:['ticket-1']});run('coordenacao','close',{group:'G02'});run('coordenacao','call',{group:'G02'});
 run('guias','arrive',{group:'G02'});run('guias','start',{group:'G02',physicallySafe:true});run('guias','safe',{group:'G02'});run('guias','finish',{group:'G02'});
 assert.equal(db.sessions[day].groups[1].status,'finished');assert.equal(db.sessions['2026-11-13'].people.length,0);
});
test('produção não aceita simulação, reset ou ações de outro posto',()=>{
 for(const a of ['scan','reset','takeover'])assert.throws(()=>live.command(ops.fresh(),day,'geral',a,{}));
 assert.throws(()=>live.command(ops.fresh(),day,'portaria','assign',{ids:['ticket-1'],group:'G01'}));
});
test('telão e guias não recebem dados pessoais nem histórico oculto',()=>{
 const db=live.admit(ops.fresh(),day,arrival).db;db.sessions[day].history.push({text:arrival.name});
 for(const role of ['telao','guias']){const data=JSON.stringify(live.project(db,role));assert.ok(!data.includes(arrival.name));assert.ok(!data.includes('ticket-1'));assert.ok(!data.includes('person-1'));}
 assert.ok(JSON.stringify(live.project(db,'coordenacao')).includes(arrival.name));
});
