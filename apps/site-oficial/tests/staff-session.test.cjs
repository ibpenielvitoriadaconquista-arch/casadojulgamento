const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sessions=require('../lib/staff-session.cjs');
const jwt=exp=>'header.'+Buffer.from(JSON.stringify({exp})).toString('base64url')+'.signature';
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;}});
const data={user:{id:'verified-user'},access_token:jwt(Math.floor(Date.now()/1000)+3600),refresh_token:'rotated-refresh',expires_in:3600};
test('access remains short lived, refresh is HttpOnly, and logout clears both cookies',()=>{
 const cookies=sessions.sessionCookies(data);assert.equal(cookies.length,2);for(const c of cookies){assert.match(c,/HttpOnly/);assert.match(c,/SameSite=Strict/);}
 assert.match(cookies[0],/Max-Age=3600/);assert.match(cookies[1],/Max-Age=86400/);
 assert.ok(sessions.clearCookies().every(c=>c.includes('Max-Age=0')));
 assert.throws(()=>sessions.sessionCookies({access_token:'only-access'}));
});
test('idle access tokens are renewed before expiry and expired/missing tokens recover',()=>{
 const now=Date.now();assert.equal(sessions.needsRefresh(jwt(Math.floor(now/1000)+3600),now),false);
 for(const token of [undefined,'bad',jwt(Math.floor(now/1000)+200),jwt(Math.floor(now/1000)-3600)])assert.equal(sessions.needsRefresh(token,now),true);
});
test('renewal rotates cookies and rechecks active staff without exposing tokens in result',async()=>{
 const req={cookies:{peniel_refresh:'old-refresh'}},response=res();let checked;
 const out=await sessions.renew({req,res:response,config:{url:'https://auth.example',key:'publishable'},query:async(sql,args)=>{assert.match(sql,/active=true/);checked=args[0];return {rows:[{user_id:args[0],role:'telao'}]};},fetcher:async(url,options)=>{assert.match(url,/grant_type=refresh_token/);assert.equal(JSON.parse(options.body).refresh_token,'old-refresh');return {ok:true,json:async()=>data};}});
 assert.equal(checked,'verified-user');assert.equal(out.role,'telao');assert.equal(req.cookies.peniel_refresh,'rotated-refresh');assert.equal(response.headers['Set-Cookie'].length,2);assert.doesNotMatch(JSON.stringify(out),/rotated-refresh|signature/);
});
test('network/rate/server errors preserve renewable cookies; revoked refresh clears them',async()=>{
 for(const status of [400,401,403,429,500,503]){
  const response=res();await assert.rejects(sessions.renew({req:{cookies:{peniel_refresh:'r'}},res:response,config:{url:'https://auth.example',key:'p'},query:async()=>{throw Error('must not query')},fetcher:async()=>({ok:false,status})}),e=>e.status===([400,401,403].includes(status)?401:503));
  if([400,401,403].includes(status))assert.ok(response.headers['Set-Cookie'].every(c=>c.includes('Max-Age=0')));else assert.equal(response.headers['Set-Cookie'],undefined);
 }
});
test('deactivated staff and retired roles cannot renew',async()=>{
 for(const rows of [[],[{role:'guias'}]]){const response=res();await assert.rejects(sessions.renew({req:{cookies:{peniel_refresh:'r'}},res:response,config:{url:'https://auth.example',key:'p'},query:async()=>({rows}),fetcher:async()=>({ok:true,json:async()=>data})}),e=>e.status===403);assert.ok(response.headers['Set-Cookie'].every(c=>c.includes('Max-Age=0')));}
});
test('actor recovers after an hour without interaction and still verifies token with Auth',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../lib/operation-auth.js'),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');let calls=[];
 const fetcher=async url=>{calls.push(url);return {ok:true,json:async()=>url.includes('/token?')?data:{id:'verified-user'}};};
 const query=async()=>({rows:[{user_id:'verified-user',role:'telao'}]});
 const actor=new Function('query','staffSession','fetch','process',source+';return actor;')(query,{...sessions,renew:args=>sessions.renew({...args,fetcher})},fetcher,{env:{NEXT_PUBLIC_SUPABASE_URL:'https://auth.example',SUPABASE_ANON_KEY:'p'}});
 const response=res();const user=await actor({cookies:{peniel_session:jwt(Math.floor(Date.now()/1000)-3600),peniel_refresh:'refresh'}},response);
 assert.equal(user.role,'telao');assert.equal(calls.length,2);assert.match(calls[0],/refresh_token/);assert.match(calls[1],/\/user$/);assert.equal(response.headers['Set-Cookie'].length,2);
});
test('heartbeat endpoint enforces origin and authentication, returns no credentials',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../pages/api/operacao/sessao.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
 const fail=(status,msg)=>Object.assign(Error(msg),{status});
 for(const scenario of ['ok','origin','anonymous','method']){
  let called=false;const fn=new Function('actor','fail','sameOrigin',source)(async()=>{called=true;if(scenario==='anonymous')throw fail(401,'login');return {role:'telao'};},fail,()=>{if(scenario==='origin')throw fail(403,'origin');});
  const response={...res(),status(n){this.code=n;return this;},json(body){this.code||=200;this.body=body;}};
  await fn({method:scenario==='method'?'GET':'POST',cookies:{peniel_refresh:'private'}},response);
  assert.equal(response.code,{ok:200,origin:403,anonymous:401,method:405}[scenario]);assert.doesNotMatch(JSON.stringify(response.body),/private/);if(scenario==='origin'||scenario==='method')assert.equal(called,false);
 }
});
