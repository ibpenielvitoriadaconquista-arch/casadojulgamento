const test=require('node:test'),assert=require('node:assert/strict');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs');
for(const [day,groups,total] of [['09',25,625],['13',20,500],['14',30,750],['19',20,500],['20',30,750],['21',30,750]]){
 const session='2026-11-'+day;
 test(session+' permite 25 por grupo e bloqueia excedentes sem alterar estado',()=>{
  let db=ops.fresh();assert.equal(db.sessions[session].groups.length,groups);
  for(let i=0;i<26;i++)db=ops.apply(db,session,'geral','scan').db;
  const ids=db.sessions[session].people.map(p=>p.id);
  db=ops.apply(db,session,'coordenacao','assign',{ids:ids.slice(0,25),group:'G01'}).db;
  assert.equal(db.sessions[session].groups[0].members.length,25);
  assert.throws(()=>ops.apply(db,session,'coordenacao','assign',{ids:[ids[25]],group:'G01'}),/vagas/);
  db=ops.apply(db,session,'coordenacao','assign',{ids:[ids[25]],group:'G02'}).db;
  assert.throws(()=>ops.apply(db,session,'coordenacao','move',{id:ids[25],group:'G01',reason:'família'}),/lotado/);
  assert.equal(ops.apply(db,session,'geral','reset').db.sessions[session].groups.length,groups);
 });
 test(session+' admite a última vaga de '+total+' e bloqueia a próxima',()=>{
  let db=ops.fresh();db.sessions[session].people=Array.from({length:total-1},(_,i)=>({id:String(i)}));
  const arrival={verified:true,participantId:'p',registrationId:'last',entryId:'entry',name:'Pessoa'};
  db=live.admit(db,session,arrival).db;assert.equal(db.sessions[session].people.length,total);
  assert.equal(live.admit(db,session,arrival).duplicate,true);
  assert.throws(()=>live.admit(db,session,{...arrival,registrationId:'extra'}),/lotada/);
 });
}
