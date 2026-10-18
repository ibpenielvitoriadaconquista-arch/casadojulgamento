const test = require('node:test');
const assert = require('node:assert/strict');
const { createWebhookHandler, validateEnvelope } = require('../lib/even3-webhook.cjs');
const env = { EVEN3_WEBHOOK_TOKEN: 'test-only-secret', EVEN3_EVENT_ID: '798621', DATABASE_URL: 'test-only' };
const body = { id: 'fixture-123', created: 1792250000, type: { name: 'Participante realizou checkin na atividade' }, evento: { id: 798621 } };
async function call({ save = async () => ({ duplicate: false }), overrides = {}, config = env, quarantine } = {}) {
  const res = { headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(code) { this.code=code; return this; }, json(value) { this.body=value; return this; } };
  await createWebhookHandler({ save, quarantine, env: config })({ method: 'POST', headers: { 'authorization-token': env.EVEN3_WEBHOOK_TOKEN, 'content-type': 'application/json' }, body, ...overrides }, res);
  return res;
}
test('rejects forged credentials without writing', async () => {
  let writes=0; const res=await call({ save: async()=>{writes++;}, overrides:{headers:{'authorization-token':'wrong'}} });
  assert.equal(res.code,401); assert.equal(writes,0);
});
test('rejects other events and incomplete envelopes', () => {
  assert.equal(validateEnvelope({...body,evento:{id:123}},'798621'),null);
  assert.equal(validateEnvelope({...body,id:undefined},'798621'),null);
});
test('only acknowledges successful durable writes', async () => {
  assert.equal((await call()).code,200);
  const failed=await call({save:async()=>{throw new Error('database offline');}});
  assert.equal(failed.code,503); assert.equal(failed.headers['Retry-After'],'60');
});
test('duplicates acknowledge but conflicting IDs reject', async () => {
  assert.equal((await call({save:async()=>({duplicate:true})})).body.duplicate,true);
  assert.equal((await call({save:async()=>({duplicate:true,conflict:true})})).code,409);
});
test('missing storage refuses delivery and health does not imply readiness', async () => {
  assert.equal((await call({config:{...env,DATABASE_URL:''}})).code,503);
  const health=await call({overrides:{method:'GET'}}); assert.equal(health.body.phase,'registration-intake');
});
test('rejects non-json and unsupported methods', async () => {
  assert.equal((await call({overrides:{headers:{'authorization-token':env.EVEN3_WEBHOOK_TOKEN,'content-type':'text/plain'}}})).code,415);
  assert.equal((await call({overrides:{method:'DELETE'}})).code,405);
});

test('token variants require exact secret and never accept payload credentials', async()=>{
 for(const [name,value] of [['x-token-even3',env.EVEN3_WEBHOOK_TOKEN],['token',env.EVEN3_WEBHOOK_TOKEN],['authorization',env.EVEN3_WEBHOOK_TOKEN],['authorization','Bearer '+env.EVEN3_WEBHOOK_TOKEN]]){
  assert.equal((await call({overrides:{headers:{[name]:value,'content-type':'application/json'}}})).code,200);
 }
 assert.equal((await call({overrides:{headers:{authorization:'Bearer wrong','content-type':'application/json'},body:{...body,token:env.EVEN3_WEBHOOK_TOKEN}}})).code,401);
 assert.equal((await call({config:{...env,EVEN3_WEBHOOK_HEADER:'custom-token'}})).code,401);
});

 test('unknown authenticated payload is quarantined without operational processing',async()=>{
  let captures=0,writes=0;
  const options={overrides:{body:{...body,evento:undefined}},quarantine:async()=>{captures++;},save:async()=>{writes++;}};
  assert.equal((await call(options)).code,202);assert.equal(captures,1);assert.equal(writes,0);
  assert.equal((await call({...options,quarantine:async()=>{throw Error('offline');}})).code,503);
  assert.equal((await call({...options,overrides:{...options.overrides,headers:{'x-token-even3':'wrong','content-type':'application/json'}}})).code,401);
  assert.equal(captures,1);
 });
