const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ownership=require('../lib/group-ownership.cjs');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const state={people:[{id:'person-1',group:'G01'},{id:'person-2',group:'G02'}]};
test('coordenações paralelas não editam grupos de outros responsáveis',()=>{
 const own={G01:{coordinator_id:'alice'},G02:{coordinator_id:'bruno'}};
 assert.equal(ownership.permitted('coordenacao','alice','assign',['G01'],own),true);
 assert.equal(ownership.permitted('coordenacao','alice','assign',['G02'],own),false);
 assert.equal(ownership.permitted('coordenacao','alice','deliver',['G01','G02'],own),false);
 assert.equal(ownership.permitted('coordenacao','alice','move',['G01','G02'],own),false);
 assert.equal(ownership.permitted('geral','gestao','move',['G01','G02'],own),true);
 assert.deepEqual(ownership.affected('move',{id:'person-1',group:'G02'},state),['G01','G02']);
 assert.deepEqual(ownership.affected('deliver',{ids:['person-1','person-2']},state),['G01','G02']);
});
test('guia deve assumir seu grupo; guia diferente não interfere',()=>{
 const own={G01:{guide_id:'guia-a'},G02:{guide_id:'guia-b'}};
 for(const action of ['arrive','start','safe','finish']){
  assert.equal(ownership.permitted('guias','guia-a',action,['G01'],own),true);
  assert.equal(ownership.permitted('guias','guia-a',action,['G02'],own),false);
 }
 assert.equal(ownership.permitted('guias','guia-a','start',['G03'],own),false);
});
test('API exige transação, auditoria, autenticação e revisão concorrente',()=>{
 const api=read('pages/api/operacao/index.js');
 for(const exp of [/await actor\(req\)/,/FOR UPDATE/,/ownership\.permitted/,/claim_coordinator/,/claim_guide/,/release_coordinator/,/release_guide/,/group_ownership_audit/,/user\.role!=='geral'/,/nextRevision/])assert.match(api,exp);
});
test('painel disponibiliza reivindicação e liberação sem compartilhar senhas',()=>{
 const ui=read('components/OperationTraining.jsx');
 for(const exp of [/claim_coordinator/,/claim_guide/,/release_coordinator/,/release_guide/,/canGroup\(/])assert.match(ui,exp);
});
