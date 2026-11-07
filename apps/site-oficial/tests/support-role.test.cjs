const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs');
const {cleanInput}=require('../lib/staff-requests.cjs');
const day='2026-11-09';
test('Apoio controls the entire former guide flow and legacy guides cannot issue commands',()=>{
 let db=live.admit(ops.fresh(),day,{verified:true,participantId:'p',registrationId:'ticket',entryId:'e',name:'Pessoa'}).db;
 for(const [action,arg] of [['assign',{ids:['ticket'],group:'G01'}],['deliver',{ids:['ticket']}],['close',{group:'G01'}],['call',{group:'G01'}]])db=live.command(db,day,'coordenacao',action,arg).db;
 for(const action of ['arrive','start','safe','finish']){
  assert.throws(()=>live.command(db,day,'guias',action,{group:'G01',physicallySafe:true}));
  db=live.command(db,day,'apoio',action,{group:'G01',physicallySafe:true}).db;
 }
 assert.equal(db.sessions[day].groups[0].status,'finished');assert.equal(ops.ROLES.guias,undefined);
 for(const action of ['scan','assign','pause','guide','caravanSave'])assert.throws(()=>live.command(db,day,'apoio',action,{}));
});
test('support receives called group names only, without contact data, private codes or hidden history',()=>{
 const db=ops.fresh(),s=db.sessions[day];
 s.people=[{id:'visible',name:'Pessoa chamada',group:'G01',email:'private@example.com',phone:'77999999999',registrationId:'secret-registration'},{id:'waiting',name:'Pessoa no salão',group:'G02'}];s.groups[0].members=['visible'];s.groups[0].status='called';s.groups[1].members=['waiting'];s.history=[{text:'Ocorrência privada'}];
 const out=live.project(db,'apoio'),json=JSON.stringify(out);
 assert.match(json,/Pessoa chamada/);for(const value of ['Pessoa no salão','private@example.com','77999999999','secret-registration','Ocorrência privada'])assert.ok(!json.includes(value));
 assert.throws(()=>live.project(db,'guias'));assert.equal(s.people.length,2);
});
test('retired guide role cannot sign up and existing guide sessions are rejected by server actor',async()=>{
 for(const role of ['guia','guias'])assert.throws(()=>cleanInput({name:'Teste',email:'a@example.com',whatsapp:'77999999999',role}));
 const src=fs.readFileSync(path.join(__dirname,'../lib/operation-auth.js'),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
 for(const role of ['guias','apoio']){
  const actor=new Function('query','fetch','process',src+';return actor;')(async()=>({rows:[{user_id:'id',role}]}),async()=>({ok:true,json:async()=>({id:'id'})}),{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'fake'}});
  const pending=actor({cookies:{peniel_session:'fake'}});
  if(role==='guias')await assert.rejects(pending,e=>e.status===403&&/desativada/.test(e.message));else assert.equal((await pending).role,'apoio');
 }
});
test('management can reject legacy guide requests but cannot approve retired access',async()=>{
 const src=fs.readFileSync(path.join(__dirname,'../pages/api/operacao/solicitacoes.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
 for(const action of ['approve','reject']){
  let updates=0;const query=async sql=>{if(sql.startsWith('UPDATE')){updates++;return {rows:[{id:'id'}],rowCount:1};}return {rows:[{requested_role:'guias'}]};};
  const handler=new Function('query','transaction','actor','fail','sameOrigin','authClient','throttle','ops',src)(query,()=>{throw Error('Unexpected mutation');},async()=>({role:'geral',user_id:'manager'}),(status,message)=>Object.assign(Error(message),{status}),()=>{},()=>{throw Error('No invitation expected');},async()=>{},ops);
  const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.code||=200;this.data=data;}};
  await handler({method:'POST',body:{id:'11111111-1111-4111-8111-111111111111',action}},res);
  assert.equal(res.code,action==='approve'?422:200);assert.equal(updates,action==='reject'?1:0);
 }
});
