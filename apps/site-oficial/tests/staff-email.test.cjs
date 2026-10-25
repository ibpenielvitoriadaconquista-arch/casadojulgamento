const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const mail=require('../lib/staff-email.cjs'),templates=require('../lib/staff-mail-templates.cjs');
const env={RESEND_API_KEY:'test-secret-not-real',STAFF_MAIL_FROM:'Casa do Julgamento <equipe@example.org>'};
function fixture({status=200,configured=true}={}){
 const row={id:'11111111-1111-4111-8111-111111111111',full_name:'Pessoa de teste',recipient:'audit@example.org',requested_role:'guias',message:templates.application({name:'Pessoa de teste',role:'guias'}),status:'pending',attempts:0};
 const calls=[];let requests=0,payload;
 const query=async(sql,args)=>{calls.push({sql,args});if(sql.includes("SET status='sending'")){if(row.status==='accepted')return {rows:[]};row.sender||=args[1];row.status='sending';row.attempts++;return {rows:[{...row}]};}if(sql.includes("SET status='accepted'")){row.status='accepted';return {rows:[]};}if(sql.includes("SET status='failed'")){row.status='failed';return {rows:[]};}throw Error(sql);};
 const fetcher=async(url,options)=>{requests++;assert.equal(url,'https://api.resend.com/emails');payload=options;return {ok:status===200,status,json:async()=>({id:'provider-message'})};};
 return {row,calls,get requests(){return requests},get payload(){return payload},service:mail.createService({query,fetcher,env:configured?env:{}})};
}
test('emails have Portuguese identity and auth templates preserve the official secure URL',()=>{
 for(const message of [templates.recovery(),templates.invite()]){assert.match(message.html,/lang="pt-BR"/);assert.match(message.html,/CASA DO/);assert.match(message.html,/href="{{ .ConfirmationURL }}"/);assert.doesNotMatch(message.html,/localhost|<script|<form|TokenHash/);}
 const ack=templates.application({name:'<img src=x onerror=alert(1)>',role:'portaria'});
 assert.doesNotMatch(ack.html,/<img/);assert.match(ack.html,/&lt;img/);assert.match(ack.html,/não libera acesso/);assert.match(ack.html,/Portaria/);
});
test('missing sender configuration preserves queued email without attempting a send',async()=>{
 const f=fixture({configured:false});assert.equal((await f.service.dispatch(f.row.id)).status,'pending');assert.equal(f.requests,0);assert.equal(f.calls.length,0);
});
test('accepted email is not sent again and uses a stable idempotency key',async()=>{
 const f=fixture();assert.equal((await f.service.dispatch(f.row.id)).status,'accepted');assert.equal((await f.service.dispatch(f.row.id)).status,'unchanged');assert.equal(f.requests,1);
 assert.equal(f.payload.headers['Idempotency-Key'],'cdj-application/'+f.row.id);assert.deepEqual(JSON.parse(f.payload.body).to,['audit@example.org']);
 const sql=f.calls[0].sql;assert.match(sql,/interval '23 hours'/);assert.match(sql,/attempts<5/);assert.match(sql,/interval '2 minutes'/);
});
test('provider failures stay pending for management retry and never expose secrets',async()=>{
 const f=fixture({status:503});assert.equal((await f.service.dispatch(f.row.id)).status,'failed');assert.equal(f.row.status,'failed');assert.equal(f.calls.at(-1).args[1],'HTTP_503');
 await f.service.dispatch(f.row.id);assert.equal(f.payload.headers['Idempotency-Key'],'cdj-application/'+f.row.id);assert.equal(f.requests,2);
 assert.doesNotMatch(JSON.stringify(f.calls),/test-secret/);
});
test('repeat signup does not queue or send a second confirmation; mail failure does not undo saved signup',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../pages/api/operacao/solicitar.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
 for(const repeated of [false,true]){
  let writes=0,sends=0;
  const query=async sql=>{if(sql.includes('access_requests'))return {rows:repeated?[]:[{id:'request-id'}]};writes++;return {rows:[{id:'mail-id'}]};};
  const handler=new Function('query','transaction','fail','sameOrigin','throttle','requests','mail','templates',source)(query,fn=>fn({query}),()=>{},()=>{},async()=>{}, {cleanInput:()=>({name:'Pessoa',email:'audit@example.org',whatsapp:'77000000000',role:'guias'})},{createService:()=>({dispatch:async()=>{sends++;throw Error('provider unavailable');}})},templates);
  const res={setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};
  await handler({method:'POST',body:{}},res);assert.equal(res.code,202);assert.equal(writes,repeated?0:1);assert.equal(sends,repeated?0:1);
 }
});
test('email management endpoint rejects anonymous and all non-manager roles',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../pages/api/operacao/emails.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export default async function handler','return async function handler');
 const fail=(status,message)=>Object.assign(Error(message),{status});
 for(const role of [null,'guias','coordenacao','portaria','caixa','apoio','geral']){
  let reads=0;const handler=new Function('actor','fail','sameOrigin','query','mail',source)(async()=>{if(!role)throw fail(401,'login');return {role}},fail,()=>{},async()=>{reads++;return {rows:[]}},mail);
  const res={setHeader(){},status(n){this.code=n;return this},json(body){this.code||=200;this.body=body;return this}};await handler({method:'GET'},res);
  assert.equal(res.code,!role?401:role==='geral'?200:403);assert.equal(reads,role==='geral'?1:0);
 }
});
