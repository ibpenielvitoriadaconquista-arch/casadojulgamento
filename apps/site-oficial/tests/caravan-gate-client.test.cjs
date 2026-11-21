const test=require('node:test'),assert=require('node:assert/strict'),client=require('../lib/caravan-gate-client.cjs');
const code='CAR-11111111-1111-4111-8111-111111111111',command={session:'2026-11-21',role:'portaria',action:'caravanAdmit',arg:{code},revision:3,requestId:'22222222-2222-4222-8222-222222222222'};
const data=admitted=>({revision:4,members:[{code,name:'Pessoa teste',admitted}],pendingLists:[]});
const response=(body,ok=true)=>({ok,json:async()=>body});
test('confirmed native admission updates from the POST response with no extra GET or authentication roundtrip',async()=>{
 const calls=[];const result=await client.send({command,fetcher:async(url,options)=>{calls.push({url,options});return response({message:'Entrada registrada',caravanGate:data(true)});}});
 assert.equal(result.confirmed,true);assert.equal(calls.length,1);assert.equal(calls[0].options.method,'POST');assert.deepEqual(JSON.parse(calls[0].options.body),command);
});
test('a lost POST response is reconciled by a read and never blindly retransmitted',async()=>{
 const methods=[];const result=await client.send({command,fetcher:async(url,options)=>{methods.push(options.method||'GET');if(options.method==='POST')throw Error('Timeout');return response(data(true));}});
 assert.equal(result.confirmed,true);assert.equal(result.reconciled,true);assert.deepEqual(methods,['POST','GET']);
});
test('an already-registered response from another gate is confirmed only after reading the persisted arrival',async()=>{
 const result=await client.send({command,fetcher:async(url,options)=>options.method==='POST'?response({error:'Este integrante já entrou.'},false):response(data(true))});assert.equal(result.confirmed,true);assert.equal(result.reconciled,true);
});
test('a server rejection or an unregistered result never displays success',async()=>{
 for(const body of [{error:'Aguarde autorização'}, {message:'Não comprovado',caravanGate:data(false)}]){
  let posts=0;const result=await client.send({command,fetcher:async(url,options)=>{if(options.method==='POST'){posts++;return response(body,!body.error);}return response(data(false));}});
  assert.equal(result.confirmed,false);assert.ok(result.error);assert.equal(result.online,true);assert.equal(posts,1);
 }
});
test('when both confirmation and reconciliation fail the result remains uncertain and offline',async()=>{
 const result=await client.send({command,fetcher:async()=>{throw Error('Rede indisponível');}});assert.equal(result.confirmed,false);assert.equal(result.online,false);assert.equal(result.uncertain,true);
});
test('the client remains compatible with an older successful API response by checking the current list',async()=>{
 const result=await client.send({command,fetcher:async(url,options)=>response(options.method==='POST'?{message:'Entrada registrada',db:{}}:data(true))});assert.equal(result.confirmed,true);assert.equal(result.reconciled,true);
});
