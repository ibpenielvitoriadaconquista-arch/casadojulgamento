const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs'),caravans=require('../lib/caravans.cjs'),tickets=require('../lib/entry-tickets.cjs');
const day='2026-11-09',at='2026-11-09T20:00:00Z',id='11111111-1111-4111-8111-111111111111',code='CAR-22222222-2222-4222-8222-222222222222',code2='CAR-33333333-3333-4333-8333-333333333333';
const draft={id,name:'Caravana direta',city:'Outra cidade',responsible:'Líder da caravana',contact:'77999999999',group:'G06',members:[{code,name:'Maria Silva',phone:'(77) 99999-9999'},{code:code2,name:'Pedro Silva',phone:''}]};
const run=(db,role,action,arg,now=at)=>live.command(db,day,role,action,{...arg,actorId:'operator'},now).db;
const saved=()=>run(ops.fresh(),'coordenacao','caravanSave',draft);
const authorized=()=>run(saved(),'caixa','caravanAuthorize',{id,method:'dinheiro',reference:'Recebimento conferido pelo operador'});
test('direct roster needs no email or Even3 ticket and accepts shared or absent phones',()=>{
 const db=saved(),rows=caravans.gateRows(db.sessions[day],day,at);
 assert.equal(rows.length,2);assert.equal(rows[0].phone,'77999999999');assert.equal(rows[1].phone,'');assert.equal(rows[1].contact,'77999999999');
 assert.equal(rows.every(r=>!r.eligible),true);assert.equal(db.sessions[day].people.length,0);
 for(const row of rows)assert.equal(tickets.parseTicketCode(row.code),null);
});
test('direct admission requires an authorized roster, correct day and portaria role',()=>{
 assert.throws(()=>run(saved(),'portaria','caravanAdmit',{code}),/Caixa ou da Gestão/);
 const db=authorized();assert.throws(()=>run(db,'portaria','caravanAdmit',{code},'2026-11-10T20:00:00Z'),/dia da apresentação/);
 for(const role of ['caixa','coordenacao','guias','apoio','telao'])assert.throws(()=>run(db,role,'caravanAdmit',{code}),/Somente Portaria/);
 for(const role of ['portaria','coordenacao','guias','apoio','telao'])assert.throws(()=>run(saved(),role,'caravanAuthorize',{id,method:'cortesia',reference:'Autorizada'}),/Somente Caixa/);
});
test('each native member reaches coordination independently and cannot enter twice',()=>{
 let db=run(authorized(),'portaria','caravanAdmit',{code});
 assert.equal(db.sessions[day].people[0].source,'caravan');assert.equal(db.sessions[day].people[0].caravan.city,'Outra cidade');assert.equal(db.sessions[day].people[0].group,null);
 assert.throws(()=>run(db,'portaria','caravanAdmit',{code}),/já entrou/);
 db=run(db,'portaria','caravanAdmit',{code:code2});assert.equal(db.sessions[day].people.length,2);
 db=run(db,'coordenacao','assign',{ids:[code,code2],group:'G06'});assert.equal(db.sessions[day].groups[5].members.length,2);
 assert.equal(caravans.gateRows(db.sessions[day],day,at).every(m=>m.admitted&&!m.eligible),true);
});
test('new members reset authorization; revocation blocks future admissions without erasing history',()=>{
 let db=authorized();db=run(db,'portaria','caravanAdmit',{code});
 db=run(db,'geral','caravanAuthorize',{id,method:'revogar',reference:'Conferência necessária'});
 assert.throws(()=>run(db,'portaria','caravanAdmit',{code:code2}),/Caixa ou da Gestão/);assert.equal(db.sessions[day].people.length,1);
 db=run(db,'geral','caravanSave',{...draft,members:[...draft.members,{name:'Novo integrante',code:'CAR-44444444-4444-4444-8444-444444444444'}]});
 assert.equal(db.sessions[day].caravans[0].authorization,null);
 assert.throws(()=>run(db,'coordenacao','caravanSave',{...draft,members:[{...draft.members[0],name:'Outra pessoa'},draft.members[1]]}),/quem já entrou/);
});
const fail=(status,message)=>Object.assign(Error(message),{status});
test('two concurrent gate requests persist one native arrival and audit the real actor',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../pages/api/operacao/index.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
 const initial=authorized(),row={state:initial.sessions[day],revision:initial.revision};let serial=Promise.resolve(),writes=0;
 const query=async(sql,args)=>{
  if(sql.startsWith('SELECT state'))return {rows:[structuredClone(row)]};
  if(sql.includes('SELECT payload_hash'))return {rows:[]};
  if(sql.includes('count(*)'))return {rows:[{total:0}]};
  if(sql.startsWith('UPDATE peniel_ops.session_state')){row.state=JSON.parse(args[1]);row.revision=args[2];writes++;return {rows:[]};}
  if(sql.startsWith('INSERT INTO peniel_ops.command_log'))return {rows:[]};
  throw Error(sql);
 };
 const transaction=fn=>{const job=serial.then(()=>fn({query}));serial=job.catch(()=>{});return job;};
 // Fix only the clock while using the real command and API logic.
 const clocked={...live,command:(db,session,role,action,arg)=>live.command(db,session,role,action,arg,at)};
 async function call(user){
  const handler=new Function('createHash','query','transaction','actor','fail','sameOrigin','ops','live',source)(createHash,query,transaction,async()=>({role:'portaria',user_id:user}),fail,()=>{},ops,clocked);
  const res={setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;this.code||=200;}};
  await handler({method:'POST',body:{session:day,role:'portaria',action:'caravanAdmit',arg:{code,actorId:'forged'},revision:initial.revision,requestId:'55555555-5555-4555-8555-555555555555'}},res);return res;
 }
 const results=await Promise.all([call('gate-a'),call('gate-b')]);assert.deepEqual(results.map(r=>r.code).sort(),[200,409]);assert.equal(writes,1);assert.equal(row.state.people.length,1);assert.equal(row.state.people[0].admittedBy,'gate-a');
});
test('dedicated gate query is authenticated and reveals no records to other roles',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../pages/api/operacao/caravanas.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export default async function handler','return async function handler');
 for(const role of ['geral','portaria','caixa','coordenacao','guias','apoio','telao',null]){
  const handler=new Function('actor','fail','query','caravans',source)(async()=>{if(!role)throw fail(401,'Login necessário');return {role};},fail,async()=>({rows:[{state:saved().sessions[day],revision:1}]}),caravans);
  const res={setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;this.code||=200;}};await handler({method:'GET',query:{session:day}},res);
  assert.equal(res.code,!role?401:['geral','portaria','caixa'].includes(role)?200:403);
  if(res.code!==200)assert.equal(res.body.members,undefined);
 }
});
