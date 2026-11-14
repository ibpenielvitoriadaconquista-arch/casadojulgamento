const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs'),caravans=require('../lib/caravans.cjs');
const day='2026-11-09',id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const member={name:'Pedro',code:'77772710'};
const draft={id,name:'Caravana Esperança',city:'Cidade de origem',responsible:'Responsável reservado',contact:'CONTATO-PRIVADO',eta:'17:00',group:'G03',members:[member]};
const command=(db,action,arg,role=['close','reopen','call'].includes(action)?'telao':'coordenacao')=>live.command(db,day,role,action,arg,'2026-11-09T19:00:00Z').db;
const register=()=>command(ops.fresh(),'caravanSave',draft);
const arrival=(db,code=member.code,name=member.name)=>live.admit(db,day,{verified:true,participantId:'p-'+code,registrationId:code,entryId:'968577',name,caravan:{group:'G01'}}).db;
test('all six dates reserve exactly three groups without increasing published capacity',()=>{
 for(const date of caravans.DAYS){const db=ops.fresh(),s=db.sessions[date];assert.deepEqual(s.groups.filter(g=>caravans.reserved(s,date,g.id)).map(g=>g.id),(date==='2026-11-13'?['G04','G05','G06']:date==='2026-11-14'?['G03','G04','G06','G08']:date==='2026-11-19'?['G03','G07','G08']:['2026-11-09','2026-11-14','2026-11-21'].includes(date)?['G03','G04','G05']:['G06','G07','G08']));assert.ok(s.groups.length*25>=ops.capacityFor(date).total);}
 assert.equal(caravans.enabled('2026-10-22'),true);
});
test('roster creates no admission; verified arrival gets caravan from stored ticket identity',()=>{
 const db=register();assert.equal(db.sessions[day].people.length,0);
 const next=arrival(db),p=next.sessions[day].people[0];assert.equal(p.caravan.name,draft.name);assert.equal(p.caravan.group,'G03');assert.equal(p.group,null);
 const duplicate=live.admit(next,day,{verified:true,participantId:'p',registrationId:member.code,entryId:'968577',name:'Pedro'});assert.equal(duplicate.duplicate,true);assert.equal(duplicate.db.sessions[day].people.length,1);
 assert.equal(arrival(db,'88888888','Pedro').sessions[day].people[0].caravan,undefined);
});
test('only management and coordination can register, delete, defer, release or transfer',()=>{
 for(const role of ['portaria','caixa','apoio','apoio','telao'])for(const action of ['caravanSave','caravanDelete','caravanDefer','caravanRelease','caravanTransfer'])assert.throws(()=>command(ops.fresh(),action,draft,role),/Somente/);
 assert.equal(command(ops.fresh(),'caravanSave',draft,'geral').sessions[day].caravans.length,1);
});
test('duplicate codes and overbooking are rejected before mutations',()=>{
 const db=register();assert.throws(()=>command(db,'caravanSave',{...draft,id:other}),/outra caravana/);
 assert.throws(()=>command(db,'caravanSave',{...draft,members:[member,member]}),/distintos/);
 const full={...draft,members:Array.from({length:25},(_,n)=>({name:'Integrante '+n,code:String(10000000+n)}))};
 const filled=command(ops.fresh(),'caravanSave',full);
 assert.throws(()=>command(filled,'caravanSave',{...draft,id:other}),/25 vagas/);
 assert.throws(()=>command(db,'caravanSave',{...draft,members:[...full.members,member]}),/1 e 25/);
 assert.equal(db.sessions[day].caravans[0].members.length,1);
});
test('coordination must assign caravan to its reserved group and keep public out',()=>{
 let db=arrival(register());db=arrival(db,'88888888','Público');
 assert.throws(()=>command(db,'assign',{ids:[member.code],group:'G01'}),/exclusivos/);
 assert.throws(()=>command(db,'assign',{ids:['88888888'],group:'G03'}),/exclusivos/);
 db=command(db,'assign',{ids:[member.code],group:'G03'});
 assert.throws(()=>command(db,'move',{id:member.code,group:'G04',reason:'troca'}),/exclusivos/);
 assert.equal(db.sessions[day].people[0].group,'G03');
});
test('late roster registration annotates an already admitted unassigned ticket',()=>{
 let db=arrival(ops.fresh());assert.equal(db.sessions[day].people[0].caravan,undefined);
 db=command(db,'caravanSave',draft);assert.equal(db.sessions[day].people[0].caravan.name,draft.name);
 assert.throws(()=>command(db,'caravanDelete',{id}),/já tem chegadas/);
 db=command(db,'assign',{ids:[member.code],group:'G03'});
 assert.throws(()=>command(db,'caravanSave',{...draft,group:'G04'}),/outro grupo/);
});
test('empty reservation release requires a reason and no roster or arrivals',()=>{
 assert.throws(()=>command(register(),'caravanRelease',{group:'G03',reason:'Sem caravana'}),/sem integrantes/);
 assert.throws(()=>command(ops.fresh(),'caravanRelease',{group:'G03'}),/motivo/);
 let db=command(ops.fresh(),'caravanRelease',{group:'G03',reason:'Sem previsão de caravana'});
 db=arrival(db,'88888888','Público');db=command(db,'assign',{ids:['88888888'],group:'G03'});
 assert.equal(db.sessions[day].people[0].group,'G03');
 assert.throws(()=>command(db,'caravanRelease',{group:'G03',reason:'Voltar reserva'}),/vazia/);
});
test('closed caravan requires explanation for missing members and keeps audit record',()=>{
 let db=command(ops.fresh(),'caravanSave',{...draft,members:[member,{name:'Maria',code:'77772709'}]});db=arrival(db);
 db=command(db,'assign',{ids:[member.code],group:'G03'});db=command(db,'deliver',{ids:[member.code]});
 assert.throws(()=>command(db,'close',{group:'G03'}),/Faltam 1/);
 db=command(db,'close',{group:'G03',caravanMissingReason:'Maria chegará depois'});
 assert.match(db.sessions[day].history[0].text,/Maria chegará depois/);
});
test('deferred caravan does not block later groups; resume preserves circuit safety',()=>{
 let db=arrival(register());db=arrival(db,'88888888','Público');
 for(const [code,group] of [[member.code,'G03'],['88888888','G09']]){db=command(db,'assign',{ids:[code],group});db=command(db,'deliver',{ids:[code]});db=command(db,'close',{group});}
 assert.throws(()=>command(db,'call',{group:'G09'}),/G03/);
 db=command(db,'caravanDefer',{group:'G03',reason:'Aguardar ônibus'});
 assert.throws(()=>command(db,'call',{group:'G03'}),/Retome/);
 db=command(db,'call',{group:'G09'});db=command(db,'arrive',{group:'G09'},'apoio');db=command(db,'start',{group:'G09',physicallySafe:true},'apoio');
 db=command(db,'caravanDefer',{group:'G03',reason:'Integrantes reunidos'});
 db=command(db,'call',{group:'G03'});db=command(db,'arrive',{group:'G03'},'apoio');assert.throws(()=>command(db,'start',{group:'G03',physicallySafe:true},'apoio'),/ponto seguro/);
 db=command(db,'safe',{group:'G09'},'apoio');db=command(db,'start',{group:'G03',physicallySafe:true},'apoio');assert.equal(ops.active(db.sessions[day]).length,2);
});
test('late unassigned member can be transferred atomically to another caravan group',()=>{
 let db=arrival(register());db=command(db,'caravanTransfer',{code:member.code,group:'G04',id:other,reason:'Grupo original já partiu'});
 assert.equal(db.sessions[day].caravans.length,1);assert.equal(db.sessions[day].people[0].caravan.group,'G04');
 assert.throws(()=>command(db,'assign',{ids:[member.code],group:'G03'}));
 db=command(db,'assign',{ids:[member.code],group:'G04'});assert.throws(()=>command(db,'caravanTransfer',{code:member.code,group:'G05',id,reason:'troca'}),/sem grupo/);
});
test('contacts and full rosters stay restricted; board and support have no personal identifiers',()=>{
 const db=arrival(register());
 for(const role of ['apoio','portaria','apoio','telao','caixa']){const out=JSON.stringify(live.project(db,role));assert.doesNotMatch(out,/CONTATO-PRIVADO|Responsável reservado/);}
 for(const role of ['apoio','telao'])assert.doesNotMatch(JSON.stringify(live.project(db,role)),/77772710|Pedro|Caravana Esperança/);
 for(const role of ['geral','coordenacao'])assert.match(JSON.stringify(live.project(db,role)),/CONTATO-PRIVADO/);
});
test('dedicated caravan page redirects every unauthorized role and anonymous user',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../pages/operacao/caravanas.jsx'),'utf8').split('const empty=')[0].replace(/^import .*;\n/gm,'').replace('export async function getServerSideProps','return async function getServerSideProps');
 for(const role of Object.keys(ops.ROLES)){
  const result=await new Function('actor',source)(async()=>({role}))({req:{},res:{setHeader(){}}});
  if(['geral','coordenacao','caravanas'].includes(role))assert.equal(result.props.role,role);else assert.equal(result.redirect.destination,'/operacao/'+role);
 }
 const result=await new Function('actor',source)(async()=>{throw Error('anonymous');})({req:{},res:{setHeader(){}}});assert.equal(result.redirect.destination,'/operacao/login');
});
