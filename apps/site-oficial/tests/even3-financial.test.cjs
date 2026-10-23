const {test}=require('node:test');
const assert=require('node:assert/strict');
const {diagnostic}=require('../lib/even3-financial.cjs');
const api=rows=>({request:async()=>({data:rows,count:rows.length}),items:x=>x.data});
test('financial diagnostic returns aggregate errors without exposing payment data',async()=>{
 const rows=[{reference_payment:'private-reference',buyer:'private-name'},{reference_payment:'another-reference'}];
 const result=await diagnostic(api(rows),async reference=>{if(reference==='private-reference')throw Object.assign(Error('private response body'),{diagnosticCode:'HTTP_404'});return [{email:'private@example.com'}];});
 assert.deepEqual(result,{status:'details_unavailable',paymentCount:2,results:{HTTP_404:1,OK:1}});
 assert.doesNotMatch(JSON.stringify(result),/private|reference|@/);
});
test('unknown upstream errors stay sanitized',async()=>{
 const result=await diagnostic(api([{reference_payment:'ref'}]),async()=>{throw Object.assign(Error('secret'),{diagnosticCode:'secret'});});
 assert.deepEqual(result.results,{UNAVAILABLE:1});
});
test('incomplete payment lists cannot be reported as available',async()=>{
 const result=await diagnostic({request:async()=>({count:2,data:[]}),items:x=>x.data},async()=>{throw Error('must not run');});
 assert.equal(result.status,'incomplete_payment_list');
});
