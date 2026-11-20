const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs'),cv=require('../lib/caravans.cjs'),requests=require('../lib/caravan-requests.cjs'),stock=require('../lib/sales-stock.cjs'),rules=require('../lib/official-entries.cjs');
const day='2026-11-20',at='2026-11-20T20:00:00Z',members=n=>Array.from({length:n},(_,i)=>({code:'CAR-'+randomUUID(),name:'Pessoa '+i,phone:''}));
function fixture(){const db=ops.fresh(),s=db.sessions[day];s.groups.find(g=>g.id==='G04').capacityOverride=42;s.groups.find(g=>g.id==='G06').capacityOverride=40;return db;}
function partial(){const db=fixture(),s=db.sessions[day],roster=members(20);roster.slice(0,5).forEach(m=>m.authorization={status:'authorized',method:'pix_igreja',reference:'Pagamento original',at,by:'original'});s.caravans=[{id:randomUUID(),name:'Casa de Oração - Lista 2',city:'Planalto',responsible:'Líder',contact:'77999999999',group:'G06',members:roster,authorization:null,authorizationHistory:[]}];return db;}
const run=(db,action,arg,role='geral')=>live.command(db,day,role,action,{...arg,actorId:'operator'},at).db;
test('November 20 reserves G04 G06 G07 G09; G08 returns to ordinary admission and daily capacity stays 750',()=>{
 const s=fixture().sessions[day];assert.deepEqual(cv.groupsFor(day),['G04','G06','G07','G09']);assert.equal(cv.reserved(s,day,'G08'),false);assert.equal(ops.groupSizeFor(day,s.groups[3]),42);assert.equal(ops.groupSizeFor(day,s.groups[5]),40);assert.equal(ops.capacityFor(day).total,750);
 const catalog={id_event:'798621',tickets:rules.ENTRIES.map(e=>({title:e.category,prices:[{id_ticket:e.entryId,id_ticket_price:e.priceId}]}))};assert.equal(stock.calculate({session:day,state:s,catalog,attendees:[],queriedAt:at}).protectedCaravanPlaces,152);
 assert.equal(ops.groupSizeFor('2026-11-21',{id:'G04',capacityOverride:42}),35);assert.equal(ops.groupSizeFor(day,{id:'G04',capacityOverride:43}),35);
});
test('a list of 20 preserves five paid people without authorizing fifteen pending additions',()=>{
 const db=partial(),s=db.sessions[day],c=s.caravans[0],rows=cv.gateRows(s,day,at);assert.equal(cv.authorizedCount(c),5);assert.equal(cv.authorizationStatus(c),'partial');assert.equal(rows.filter(r=>r.authorized&&r.eligible).length,5);assert.equal(rows[0].authorizedCount,5);assert.equal(rows[0].memberCount,20);
 const admitted=run(db,'caravanAdmit',{code:c.members[0].code},'portaria');assert.equal(admitted.sessions[day].people.length,1);assert.equal(admitted.sessions[day].people[0].group,null);
 assert.throws(()=>run(db,'caravanAdmit',{code:c.members[5].code},'portaria'),/Aguarde autorização/);assert.equal(db.sessions[day].people.length,0);
});
test('editing the partial list preserves only existing trusted individual grants; clients cannot supply new grants',()=>{
 let db=partial(),c=db.sessions[day].caravans[0];db=run(db,'caravanSave',{...c,members:c.members.map(m=>({...m,authorization:{status:'authorized',by:'forged'}}))},'coordenacao');c=db.sessions[day].caravans[0];assert.equal(cv.authorizedCount(c),5);assert.equal(c.members[0].authorization.by,'original');assert.equal(c.members[5].authorization,undefined);
 const modified=run(db,'caravanSave',{...c,members:c.members.map((m,i)=>i===0?{...m,name:'Outra pessoa'}:m)},'coordenacao');assert.equal(cv.authorizedCount(modified.sessions[day].caravans[0]),4);
});
test('authorizing or revoking the full list replaces individual grants and preserves their audit evidence',()=>{
 for(const method of ['pix_igreja','revogar']){let db=partial(),c=db.sessions[day].caravans[0];db=run(db,'caravanAuthorize',{id:c.id,method,reference:'Conferência do responsável'});c=db.sessions[day].caravans[0];assert.equal(cv.authorizedCount(c),method==='revogar'?0:20);assert.ok(c.members.every(m=>!Object.hasOwn(m,'authorization')));assert.equal(c.authorizationHistory.at(-1).previousMemberAuthorizations.length,5);}
});
test('two lists of 20 occupy G06; the next list cannot exceed the specifically authorized 40 places',()=>{
 let db=fixture();for(let i=0;i<2;i++)db=run(db,'caravanSave',{id:randomUUID(),name:'Casa de Oração '+i,city:'Planalto',responsible:'Responsável',group:'G06',members:members(20)});assert.equal(db.sessions[day].caravans.flatMap(c=>c.members).length,40);
 assert.throws(()=>run(db,'caravanSave',{id:randomUUID(),name:'Excesso',city:'Planalto',responsible:'Responsável',group:'G06',members:members(1)}),/40 vagas/);
});
test('G09 pending reservation is approved into its existing roster with no duplicate codes or automatic arrival',async()=>{
 const fs=require('node:fs'),source=fs.readFileSync(require('node:path').join(__dirname,'../pages/api/operacao/caravana-solicitacoes.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
 const c={id:randomUUID(),name:'Exército de Adoradoras',city:'Barra do Choça',responsible:'Organizadora',contact:'77999999999',group:'G09',members:members(20),authorization:null,authorizationHistory:[]};
 const row={state:fixture().sessions[day],revision:1};row.state.caravans=[c];const codes=c.members.map(m=>m.code);const payload={...c,session:day,reservedCaravanId:c.id,preferredGroup:'G09'};let imported=false;
 const query=async(sql,args)=>{if(sql.startsWith('SELECT * FROM peniel_ops.caravan_requests'))return {rows:[{id:19,status:'pending',payload}]};if(sql.startsWith('SELECT state'))return {rows:[structuredClone(row)]};if(sql.startsWith('UPDATE peniel_ops.session_state')){row.state=JSON.parse(args[1]);row.revision=args[2];return {rows:[]};}if(sql.startsWith('UPDATE peniel_ops.caravan_requests')){imported=true;return {rows:[]};}throw Error(sql);};
 const handler=new Function('randomUUID','query','transaction','actor','fail','sameOrigin','live','requests',source)(randomUUID,query,fn=>fn({query}),async()=>({role:'geral',user_id:'manager'}),(status,message)=>Object.assign(Error(message),{status}),()=>{},live,requests);
 assert.equal(requests.availableFor({G09:15},{payload},'G09'),35);assert.equal(requests.availableFor({G04:42},{payload},'G04'),42);
 const res={setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;this.code||=200;}};await handler({method:'POST',body:{id:19,group:'G09',method:'pix_igreja',reference:'Pagamento conferido pelo responsável',confirmed:true}},res);assert.equal(res.code,200);assert.equal(imported,true);assert.equal(row.state.caravans.length,1);assert.deepEqual(row.state.caravans[0].members.map(m=>m.code),codes);assert.equal(cv.authorizedCount(row.state.caravans[0]),20);assert.equal(row.state.people.length,0);
});

test('revoking a list blocks every individual grant even before its stored overrides are cleared',()=>{const db=partial(),c=db.sessions[day].caravans[0];c.authorization={status:'revoked'};assert.equal(cv.authorizedCount(c),0);assert.equal(cv.authorizationStatus(c),'revoked');assert.ok(cv.gateRows(db.sessions[day],day,at).every(r=>!r.authorized&&!r.eligible));});

test('November 20 G09 accommodates Exercito 20 plus Adsa 22 while each list keeps its own payment authorization',()=>{
 let db=fixture();db.sessions[day].groups.find(g=>g.id==='G09').capacityOverride=42;
 const armyId=randomUUID(),adsaId=randomUUID();
 for(const [id,name,count] of [[armyId,'Exército de Adoradoras',20],[adsaId,'Adsa Planalto',22]])db=run(db,'caravanSave',{id,name,city:'Planalto',responsible:'Não informado',group:'G09',members:members(count)});
 db=run(db,'caravanAuthorize',{id:armyId,method:'pix_igreja',reference:'Pagamento anterior confirmado'});
 assert.equal(ops.groupSizeFor(day,db.sessions[day].groups[8]),42);
 const rows=cv.gateRows(db.sessions[day],day,at);assert.equal(rows.length,42);assert.equal(rows.filter(r=>r.authorized).length,20);assert.equal(rows.filter(r=>r.caravanId===adsaId&&r.eligible).length,0);
 assert.throws(()=>run(db,'caravanSave',{id:randomUUID(),name:'Excesso',city:'Planalto',responsible:'Responsável',group:'G09',members:members(1)}),/42 vagas/);
 assert.equal(ops.groupSizeFor('2026-11-21',{id:'G09',capacityOverride:42}),35);assert.equal(ops.groupSizeFor(day,{id:'G09',capacityOverride:43}),35);
 const catalog={id_event:'798621',tickets:rules.ENTRIES.map(e=>({title:e.category,prices:[{id_ticket:e.entryId,id_ticket_price:e.priceId}]}))};assert.equal(stock.calculate({session:day,state:db.sessions[day],catalog,attendees:[],queriedAt:at}).protectedCaravanPlaces,159);
 db=run(db,'caravanAuthorize',{id:adsaId,method:'pix_igreja',reference:'Somente em simulação local do teste'});
 for(const c of db.sessions[day].caravans){for(const m of c.members){db=run(db,'caravanAdmit',{code:m.code},'portaria');assert.equal(db.sessions[day].people.at(-1).group,null);db=run(db,'assign',{ids:[m.code],group:'G09'},'coordenacao');}}
 assert.equal(db.sessions[day].groups[8].members.length,42);assert.equal(new Set(db.sessions[day].people.map(p=>p.id)).size,42);
 db=run(db,'deliver',{ids:db.sessions[day].groups[8].members,expectedGroup:'G09'},'coordenacao');db=run(db,'close',{group:'G09'},'telao');assert.equal(db.sessions[day].groups[8].status,'closed');
});

test('November 20 G07 accepts 43 authorized caravan members and asks confirmation only for the 44th assignment',()=>{
 let db=fixture();db.sessions[day].groups[6].capacityOverride=43;
 assert.equal(ops.groupSizeFor(day,db.sessions[day].groups[6]),43);
 assert.equal(ops.groupSizeFor('2026-11-21',{id:'G07',capacityOverride:43}),35);
 assert.equal(ops.groupSizeFor(day,{id:'G08',capacityOverride:43}),35);
 for(const count of [20,23]){const id=randomUUID();db=run(db,'caravanSave',{id,name:'Lista G07 '+count,city:'Planalto',responsible:'Responsável',group:'G07',members:members(count)});db=run(db,'caravanAuthorize',{id,method:'pix_igreja',reference:'Recebimento confirmado para validação local'});}
 for(const c of db.sessions[day].caravans)for(const m of c.members){db=run(db,'caravanAdmit',{code:m.code},'portaria');db=run(db,'assign',{ids:[m.code],group:'G07'},'coordenacao');}
 assert.equal(db.sessions[day].groups[6].members.length,43);
 assert.throws(()=>run(db,'caravanSave',{id:randomUUID(),name:'Excesso',city:'Planalto',responsible:'Responsável',group:'G07',members:members(1)}),/43 vagas/);
 const extra=members(1)[0];db.sessions[day].caravans.push({id:randomUUID(),name:'Lista anteriormente cadastrada',group:'G07',members:[extra],authorization:{status:'authorized'}});db=run(db,'caravanAdmit',{code:extra.code},'portaria');
 assert.throws(()=>run(db,'assign',{ids:[extra.code],group:'G07'},'coordenacao'),e=>e.groupLimit?.limit===43&&e.groupLimit?.total===44);
 db=run(db,'deliver',{ids:db.sessions[day].groups[6].members,expectedGroup:'G07'},'coordenacao');db=run(db,'close',{group:'G07',caravanMissingReason:'A pessoa excedente aguarda decisão da Gestão'},'telao');assert.equal(db.sessions[day].groups[6].status,'closed');
});
