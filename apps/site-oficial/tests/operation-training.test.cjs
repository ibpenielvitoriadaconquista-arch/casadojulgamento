const {test}=require('node:test');
const assert=require('node:assert/strict');
const ops=require('../lib/operation-training.cjs');
const day=ops.SESSIONS[0].id;
function setup(){let db=ops.fresh();return {get db(){return db},get s(){return db.sessions[day]},run(action,arg={},role='geral'){const r=ops.apply(db,day,role,action,arg);db=r.db;return r;}};}
function readyGroup(x,g,n=1){const before=x.s.people.length;for(let i=0;i<n;i++)x.run('scan');const ids=x.s.people.slice(before).map(p=>p.id);x.run('assign',{ids,group:g});x.run('deliver',{ids});x.run('close',{group:g});return ids;}
test('portaria cria chegada sem grupo; coordenação atribui pessoa exata e registra senha separadamente',()=>{
 const x=setup();x.run('scan',{},'portaria');x.run('scan',{},'portaria');const ids=x.s.people.map(p=>p.id);
 assert.equal(x.s.people[0].group,null);assert.throws(()=>x.run('assign',{ids:[ids[0]],group:'G03'},'portaria'));
 x.run('assign',{ids:[ids[1]],group:'G03'},'coordenacao');assert.equal(x.s.people[0].group,null);assert.equal(x.s.people[1].group,'G03');assert.equal(x.s.people[1].paperAt,null);assert.deepEqual(x.s.lastAssignment.ids,[ids[1]]);
 assert.throws(()=>x.run('close',{group:'G03'}),/senhas/);x.run('deliver',{ids:[ids[1]]},'coordenacao');assert.ok(x.s.people[1].paperAt);assert.throws(()=>x.run('deliver',{ids:[ids[1]]}),/já consta/);x.run('close',{group:'G03'});assert.equal(x.s.groups[2].status,'closed');
});
test('limite de 20, ausência de duplicidade e atribuição em lote atômica',()=>{
 const x=setup();for(let i=0;i<21;i++)x.run('scan');const ids=x.s.people.map(p=>p.id);
 const before=JSON.stringify(x.db);assert.throws(()=>x.run('assign',{ids,group:'G01'}),/vagas/);assert.equal(JSON.stringify(x.db),before);
 x.run('assign',{ids:ids.slice(0,20),group:'G01'});assert.equal(x.s.groups[0].members.length,20);
 assert.throws(()=>x.run('assign',{ids:[ids[0]],group:'G02'}),/já recebeu/);assert.throws(()=>x.run('assign',{ids:[ids[20]],group:'G01'}),/vagas/);assert.equal(x.s.people[20].group,null);
});
test('troca exige motivo e recolhimento da senha; novo grupo fica com entrega pendente',()=>{
 const x=setup();x.run('scan');const id=x.s.people[0].id;x.run('assign',{ids:[id],group:'G01'});x.run('deliver',{ids:[id]});
 assert.throws(()=>x.run('move',{id,group:'G02',reason:'família'}),/RECOLHIDA|Recolha/);
 x.run('move',{id,group:'G02',reason:'reunir família',paperReturned:true});assert.equal(x.s.people[0].group,'G02');assert.equal(x.s.people[0].paperAt,null);assert.equal(x.s.groups[0].members.length,0);assert.deepEqual(x.s.groups[1].members,[id]);assert.match(x.s.history[0].text,/G01 → G02/);
});
test('um grupo na espera; dois no circuito; ponto seguro ainda ocupa vaga',()=>{
 const x=setup();readyGroup(x,'G01',3);readyGroup(x,'G02');readyGroup(x,'G03');
 x.run('call',{group:'G01'});assert.throws(()=>x.run('call',{group:'G02'}),/espera/);x.run('arrive',{group:'G01'},'guias');assert.throws(()=>x.run('start',{group:'G01'}),/segurança/);x.run('start',{group:'G01',physicallySafe:true},'guias');assert.equal(ops.wait(x.s),undefined);
 x.run('call',{group:'G02'});x.run('arrive',{group:'G02'});assert.throws(()=>x.run('start',{group:'G02',physicallySafe:true}),/ponto seguro/);x.run('safe',{group:'G01'});x.run('start',{group:'G02',physicallySafe:true});x.run('safe',{group:'G02'});
 x.run('call',{group:'G03'});x.run('arrive',{group:'G03'});assert.throws(()=>x.run('start',{group:'G03',physicallySafe:true}),/dois grupos/);x.run('finish',{group:'G01'},'guias');x.run('start',{group:'G03',physicallySafe:true},'guias');assert.equal(ops.active(x.s).length,2);
});
test('pausa bloqueia partidas, permite ponto seguro/finalização; sessão isolada',()=>{
 const x=setup();readyGroup(x,'G01');x.run('call',{group:'G01'});x.run('arrive',{group:'G01'});x.run('start',{group:'G01',physicallySafe:true});x.run('pause');x.run('safe',{group:'G01'},'guias');x.run('finish',{group:'G01'},'guias');readyGroup(x,'G02');assert.throws(()=>x.run('call',{group:'G02'}),/pausad/);
 assert.equal(x.db.sessions[ops.SESSIONS[1].id].people.length,0);assert.throws(()=>x.run('pause',{},'coordenacao'));assert.throws(()=>x.run('scan',{},'telao'));x.run('reset');assert.equal(x.s.people.length,0);assert.equal(x.s.history.length,1);
});
test('webhook fictício repetido e teto de 300 não criam chegadas extras',()=>{
 const x=setup();x.run('scan',{eventId:'same'});assert.throws(()=>x.run('scan',{eventId:'same'}),/duplicada/);for(let i=1;i<300;i++)x.run('scan');assert.throws(()=>x.run('scan'),/300/);assert.equal(x.s.people.length,300);
});
