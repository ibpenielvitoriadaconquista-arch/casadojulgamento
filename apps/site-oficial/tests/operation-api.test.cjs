const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../pages/api/operacao/index.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function call({user={user_id:'user-1',role:'coordenacao'},body={},method='POST',rev=0,state}={}){
 let writes=0;const row={state:state??ops.freshSession(),revision:rev};
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
 const arg={id:'11111111-1111-4111-8111-111111111111',name:'Caravana teste',city:'Cidade teste',responsible:'Responsável',group:'G03',members:[{name:'Pessoa',code:'12345678'}]};
 for(const role of ['geral','coordenacao','portaria','caixa','apoio','apoio','telao']){
  const r=await call({user:{user_id:'x',role},body:{role,action:'caravanSave',arg}});
  const allowed=['geral','coordenacao'].includes(role);assert.equal(r.code,allowed?200:422,role);assert.equal(r.writes,allowed?1:0);
 }
 const stale=await call({rev:2,body:{action:'caravanSave',arg}});assert.equal(stale.code,409);assert.equal(stale.writes,0);
});

const day='2026-11-19';
function coordinationFixture(full=false){
 let db=ops.fresh();
 for(const [i,group] of ['G01',...(full?Array(35).fill('G02'):[]),null,null].entries()){
  db=ops.apply(db,day,'geral','scan').db;
  if(group)db=ops.apply(db,day,'coordenacao','assign',{ids:[db.sessions[day].people[i].id],group}).db;
 }
 const state=db.sessions[day], p=state.people[0], expectedMove={group:p.group,assignedAt:p.assignedAt,paperAt:p.paperAt};
 return {state,move:{id:p.id,group:'G02',reason:'reunir família',expectedMove}};
}
test('a stale session revision after a gate arrival still permits the selected move; a changed person or closed destination does not',async()=>{
 const {state,move}=coordinationFixture();
 const send=state=>call({rev:9,state,body:{session:day,action:'move',arg:move}});
 const ok=await send(state);
 assert.equal(ok.code,200);assert.equal(ok.body.db.revision,10);
 const moved=ok.body.db.sessions[day];
 assert.equal(moved.people[0].group,'G02');assert.deepEqual(moved.groups[0].members,[]);assert.deepEqual(moved.groups[1].members,[move.id]);
 const changed=await send(moved);
 assert.equal(changed.code,422);assert.match(changed.body.error,/mudou/);assert.equal(changed.writes,0);
 state.people[0].paperAt='senha entregue após abrir a troca';
 const issued=await send(state);
 assert.equal(issued.code,422);assert.match(issued.body.error,/senha desta pessoa mudou/);assert.equal(issued.writes,0);
 state.people[0].paperAt=null;state.groups[1].status='closed';
 const closed=await send(state);
 assert.equal(closed.code,422);assert.match(closed.body.error,/em formação/);assert.equal(closed.writes,0);
});

test('confirmation is for the current group size, and cannot authorize an additional arrival beyond the displayed count',async()=>{
 const {state,move}=coordinationFixture(true);
 const send=(action,arg)=>call({rev:10,state,body:{session:day,action,arg}});
 const first=await send('move',move);
 assert.equal(first.code,409);assert.equal(first.writes,0);
 assert.deepEqual(first.body.groupLimit,{group:'G02',limit:35,total:36});
 const accepted=await send('move',{...move,groupLimitConfirmation:first.body.groupLimit});
 assert.equal(accepted.code,200);assert.equal(accepted.body.db.sessions[day].groups[1].members.length,36);
 const arrived=state.people.at(-1);arrived.group='G02';state.groups[1].members.push(arrived.id);
 const changed=await send('move',{...move,groupLimitConfirmation:first.body.groupLimit});
 assert.equal(changed.code,409);assert.equal(changed.writes,0);assert.equal(changed.body.groupLimit.total,37);
 const assign={ids:[state.people.at(-2).id],group:'G02'};
 const prompt=await send('assign',assign);
 assert.equal(prompt.code,409);assert.equal(prompt.writes,0);assert.equal(prompt.body.groupLimit.total,37);
 const assigned=await send('assign',{...assign,groupLimitConfirmation:prompt.body.groupLimit});
 assert.equal(assigned.code,200);assert.equal(assigned.body.db.sessions[day].groups[1].members.length,37);
});
