const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ops=require('../lib/operation-training.cjs'),timer=require('../lib/rehearsal.cjs'),{createHash}=require('node:crypto');
const fail=(status,message)=>Object.assign(Error(message),{status});
function source(file){return fs.readFileSync(path.join(__dirname,'../pages/api/operacao/'+file),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');}
const response=()=>({setHeader(){},status(code){this.code=code;return this},json(body){this.code||=200;this.body=body;return this}});
test('gestão de colaboradores exige conta ativa de gestão e bloqueia autoalteração',async()=>{
 for(const user of [null,{user_id:'u',role:'guias'},{user_id:'u',role:'geral'}]){
  let calls=0;const fn=new Function('query','transaction','actor','fail','sameOrigin','authClient','throttle','ops',source('equipe.js'))(async()=>{calls++;return {rows:[]}},async()=>{calls++},async()=>{if(!user)throw fail(401,'login');return user},fail,()=>{},()=>{calls++;return {}},async()=>{},ops);
  const res=response();await fn({method:'POST',body:{action:'update',userId:'u',role:'apoio',active:false}},res);
  assert.equal(res.code,!user?401:user.role==='guias'?403:400);assert.equal(calls,0);
 }
});
test('API de cronômetro rejeita guia escrevendo e revisões antigas sem gravar',async()=>{
 for(const role of ['guias','apoio']){
  let writes=0;const q=async sql=>{if(sql.startsWith('UPDATE')||sql.startsWith('INSERT'))writes++;return {rows:sql.includes('rehearsal_commands')?[]:[{state:{...timer.initial(),revision:2}}]};};
  const fn=new Function('createHash','query','transaction','actor','fail','sameOrigin','timer',source('apoio.js'))(createHash,q,fn=>fn({query:q}),async()=>({user_id:'u',role}),fail,()=>{},timer);
  const res=response();await fn({method:'POST',body:{station:1,revision:0,requestId:'11111111-1111-4111-8111-111111111111',action:'start',arg:{label:'Cena',kind:'cena'}}},res);assert.equal(res.code,role==='guias'?403:409);assert.equal(writes,0);
 }
});
test('Apoio não recebe identificadores ou nomes dos participantes',()=>{const live=require('../lib/operation-live.cjs'),db=ops.fresh();db.sessions['2026-11-09'].people.push({id:'secret-id',name:'Nome pessoal',group:null});assert.ok(!JSON.stringify(live.project(db,'apoio')).includes('secret-id'));});
