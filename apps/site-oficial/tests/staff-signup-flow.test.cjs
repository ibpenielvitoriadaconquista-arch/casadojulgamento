const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ops=require('../lib/operation-training.cjs'),requests=require('../lib/staff-requests.cjs');
const templates=require('../lib/staff-mail-templates.cjs');
const fail=(status,message)=>Object.assign(Error(message),{status});
const response=()=>({setHeader(){},status(code){this.code=code;return this},json(body){this.code||=200;this.body=body;return this}});
const api=file=>read('pages/api/operacao/'+file).replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
test('solicitação salva cada posto como pendente sem criar conta ou enviar convite',async()=>{
 for(const role of ['guias','coordenacao','caixa','apoio','portaria']){
  let saved,queued=0;
  const query=async(sql,args)=>{if(sql.includes('INSERT INTO peniel_ops.access_requests'))saved=args;else {assert.match(sql,/INSERT INTO peniel_ops.staff_email_outbox/);queued++;}return {rows:[{id:'11111111-1111-4111-8111-111111111111'}]}};
  const handler=new Function('query','transaction','fail','sameOrigin','throttle','requests','mail','templates',api('solicitar.js'))(query,fn=>fn({query}),fail,()=>{},async()=>{},requests,{createService:()=>({dispatch:async()=>({status:'pending'})})},templates);
  const res=response();await handler({method:'POST',body:{name:'Teste Equipe',email:'audit@example.com',whatsapp:'77000000000',role}},res);
  assert.equal(res.code,202);assert.equal(saved[3],role);assert.equal(res.body.ok,true);assert.equal(queued,1);
 }
});
test('solicitação rejeita cargo de gestão antes de gravar',async()=>{
 let writes=0;const handler=new Function('query','fail','sameOrigin','throttle','requests',api('solicitar.js'))(async()=>{writes++},fail,()=>{},async()=>{},requests);
 const res=response();await handler({method:'POST',body:{name:'Teste Equipe',email:'audit@example.com',whatsapp:'77000000000',role:'geral'}},res);
 assert.equal(res.code,400);assert.equal(writes,0);
});
test('sucesso assíncrono limpa formulário sem acessar currentTarget após await',async()=>{
 const ui=read('pages/operacao/solicitar.jsx');const source=ui.slice(ui.indexOf(' async function send('),ui.indexOf('\n return <StaffShell'));
 let target,reset=0,errors=[],notices=[];const form={reset(){reset++}};target=form;
 const event={preventDefault(){},get currentTarget(){return target}};
 class FakeFormData{constructor(value){assert.equal(value,form)}*[Symbol.iterator](){yield ['name','Teste Equipe'];}}
 const fn=new Function('busy','setBusy','setError','setNotice','FormData','fetch',source+';return send;')(false,()=>{},x=>errors.push(x),x=>notices.push(x),FakeFormData,async()=>{target=null;return {ok:true,json:async()=>({message:'Solicitação recebida.'})}});
 await fn(event);assert.equal(reset,1);assert.equal(errors.filter(Boolean).length,0);assert.equal(notices.at(-1),'Solicitação recebida.');
});
test('aprovação mantém posto solicitado e só gestão pode aprovar ou enviar convite',async()=>{
 for(const role of ['guias','coordenacao','caixa','apoio','portaria','geral']){
  let writes=0,invites=0,assigned;
  const item={id:'11111111-1111-4111-8111-111111111111',email:'audit@example.com',full_name:'Teste Equipe',whatsapp:'77000000000',requested_role:'guias'};
  const query=async sql=>sql.includes('FROM peniel_ops.access_requests')?{rows:[item],rowCount:1}:{rows:[],rowCount:0};
  const transaction=async fn=>fn({query:async(sql,args)=>{if(sql.startsWith('INSERT INTO peniel_ops.staff(')){writes++;assigned=args[1]};return {rows:[{id:item.id}],rowCount:1}}});
  const authClient=()=>({auth:{admin:{inviteUserByEmail:async(email,options)=>{invites++;assert.equal(email,item.email);assert.equal(options.redirectTo,'https://www.ibpeniel.com/operacao/ativar');return {data:{user:{id:'test-user'}}}}}}});
  const handler=new Function('query','transaction','actor','fail','sameOrigin','authClient','throttle','ops',api('solicitacoes.js'))(query,transaction,async()=>({user_id:'manager',role}),fail,()=>{},authClient,async()=>{},ops);
  const res=response();await handler({method:'POST',body:{id:item.id,action:'approve',role:'geral'}},res);
  assert.equal(res.code,role==='geral'?200:403);assert.equal(invites,role==='geral'?1:0);assert.equal(writes,role==='geral'?1:0);if(role==='geral')assert.equal(assigned,'guias');
 }
});
