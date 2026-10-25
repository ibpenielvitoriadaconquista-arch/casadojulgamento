const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../pages/api/operacao/index.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function call({user={user_id:'user-1',role:'coordenacao'},body={},method='POST',rev=0}={}){
 let writes=0;const row={state:ops.freshSession(),revision:rev};
 const query=async sql=>{if(sql.startsWith('UPDATE'))writes++;if(sql.includes('command_log'))return {rows:[]};return {rows:[row]};};
 const handler=new Function('createHash','query','transaction','actor','fail','sameOrigin','ops','live',source)(createHash,query,fn=>fn({query}),async()=>{if(!user)throw fail(401,'login');return user;},fail,()=>{},ops,live);
 const res={setHeader(){},status(n){this.code=n;return this;},json(x){this.body=x;this.code||=200;return this;}};
 await handler({method,body:{session:'2026-11-09',role:'coordenacao',revision:0,requestId:'11111111-1111-4111-8111-111111111111',...body},query:body},res);
 return {...res,writes};
}
test('API rejeita usuário sem login e tentativa de elevar posto',async()=>{
 assert.equal((await call({user:null})).code,401);
 assert.equal((await call({user:{user_id:'x',role:'portaria'}})).code,403);
});
test('API rejeita estado antigo antes de gravar',async()=>{
 const r=await call({rev:2,body:{action:'pause'}});assert.equal(r.code,409);assert.equal(r.writes,0);
});
test('API bloqueia comandos de simulação mesmo para geral',async()=>{
 const r=await call({user:{user_id:'x',role:'geral'},body:{role:'geral',action:'scan'}});assert.equal(r.code,422);assert.equal(r.writes,0);
});
test('API persiste comando permitido e incrementa revisão',async()=>{
 const r=await call({user:{user_id:'x',role:'geral'},body:{role:'geral',action:'pause'}});assert.equal(r.code,200);assert.equal(r.writes,1);assert.equal(r.body.db.revision,1);
});

test('todos os postos recusam leitura da API de outro perfil; gestão pode consultar todos',async()=>{
 for(const role of Object.keys(ops.ROLES))for(const requested of Object.keys(ops.ROLES)){
  const r=await call({user:{user_id:'role-test',role},method:'GET',body:{session:'2026-11-09',role:requested}});
  assert.equal(r.code,role==='geral'||role===requested?200:403,role+' → '+requested);
  assert.equal(r.writes,0);
 }
});

test('caravan changes use role checks and reject stale revisions before persisting',async()=>{
 const arg={id:'11111111-1111-4111-8111-111111111111',name:'Caravana teste',city:'Cidade teste',responsible:'Responsável',group:'G06',members:[{name:'Pessoa',code:'12345678'}]};
 for(const role of ['geral','coordenacao','portaria','caixa','guias','apoio','telao']){
  const r=await call({user:{user_id:'x',role},body:{role,action:'caravanSave',arg}});
  const allowed=['geral','coordenacao'].includes(role);assert.equal(r.code,allowed?200:422,role);assert.equal(r.writes,allowed?1:0);
 }
 const stale=await call({rev:2,body:{action:'caravanSave',arg}});assert.equal(stale.code,409);assert.equal(stale.writes,0);
});
