const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const ops=require('../lib/operation-training.cjs');
const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
test('every role can open only its panel; geral can open all panels',async()=>{
 const source=read('pages/operacao/[posto].jsx').split('export default')[0].replace(/^import .*;\n/gm,'').replace('export async function getServerSideProps','return async function getServerSideProps');
 for(const role of Object.keys(ops.ROLES))for(const posto of Object.keys(ops.ROLES)){
  const fn=new Function('actor','ops',source)(async()=>({role}),ops);
  const result=await fn({req:{},res:{setHeader(){}},params:{posto}});
  if(role==='geral'||role===posto)assert.equal(result.props.role,posto);
  else assert.equal(result.redirect.destination,'/operacao/'+role);
 }
 const anon=new Function('actor','ops',source)(async()=>{throw Error('no session');},ops);
 assert.equal((await anon({req:{},res:{setHeader(){}},params:{posto:'geral'}})).redirect.destination,'/operacao/login');
});
test('public shortcuts never render training, and training route returns 404',async()=>{
 for(const role of Object.keys(ops.ROLES)){
  const s=read('pages/'+role+'.jsx');assert.ok(!s.includes('OperationTraining'));assert.ok(!s.includes('RehearsalPanel'));
  const fn=new Function(s.split('export default')[0].replace('export async function getServerSideProps','return async function getServerSideProps'))();
  assert.equal((await fn({res:{setHeader(){}}})).redirect.destination,'/operacao/'+role);
 }
 assert.match(read('pages/treinamento.jsx'),/notFound:true/);
});
