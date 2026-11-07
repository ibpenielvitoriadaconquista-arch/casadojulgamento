const test=require('node:test');
const assert=require('node:assert/strict');
const v=require('../lib/assistant-presenters.cjs');
test('confirmed registration is not presented as financial evidence',()=>{assert.equal(v.financial({payment_status:'paid',evidence_reference:'even3-confirmed-registration:123'}).tone,'warn');assert.match(v.financial({payment_status:'paid',evidence_reference:'even3-confirmed-registration:123'}).label,/não conciliado/);assert.equal(v.financial({payment_status:'paid',evidence_reference:'caixa 456'}).tone,'good');});
test('revoked evidence takes precedence over payment',()=>{assert.equal(v.financial({payment_status:'paid',revoked_at:'2026-11-07'}).tone,'danger');});
test('eligibility and admission have distinct labels',()=>{assert.equal(v.entryState({eligible:true}).label,'Apto para a Portaria');assert.equal(v.entryState({eligible:true,checkedIn:true}).tone,'danger');assert.equal(v.entryState({admitted:true}).label,'Entrada registrada');});
test('dates use the event timezone and invalid timestamps stay explicit',()=>{assert.equal(v.stamp('invalid'),'Horário não informado');assert.match(v.stamp('2026-11-09T20:00:00Z',true),/17:00/);});
