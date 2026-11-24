const test=require('node:test'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createHandler,REPORT_SLUG}=require('../lib/accountability-page.cjs');

// Synthetic fixture contains no financial data or real report ciphertext.
const encrypted_html='<!doctype html><html><body>Senha de acesso<script>const cipher=bytes("AQIDBA==");/* PBKDF2 AES-GCM */</script></body></html>';
const row={encrypted_html,sha256:createHash('sha256').update(encrypted_html).digest('hex')};
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},send(body){this.body=body;return this;},end(){return this;}};}

test('public report endpoint serves only the encrypted snapshot and ignores caller-selected reports',async()=>{
 let statement,params;
 const handler=createHandler({query:async(sql,args)=>{statement=sql;params=args;return {rows:[row]};}});
 const res=response();
 await handler({method:'GET',query:{slug:'another-private-report'}},res);
 assert.equal(res.code,200);
 assert.equal(res.body,encrypted_html);
 assert.deepEqual(params,[REPORT_SLUG]);
 assert.match(statement,/WHERE slug=\$1$/);
 assert.equal(res.headers['Content-Type'],'text/html; charset=utf-8');
 assert.match(res.headers['Cache-Control'],/no-store/);
 assert.match(res.headers['X-Robots-Tag'],/noindex/);
});

test('missing, altered or plaintext reports fail closed without disclosing contents',async()=>{
 const plaintext='<html>PRIVATE FINANCIAL CONTENT</html>';
 for(const value of [null,{...row,sha256:'0'.repeat(64)},{encrypted_html:plaintext,sha256:createHash('sha256').update(plaintext).digest('hex')}]){
  const res=response();await createHandler({query:async()=>({rows:value?[value]:[]})})({method:'GET'},res);
  assert.equal(res.code,503);assert.ok(!res.body.includes('PRIVATE'));assert.ok(!res.body.includes('cipher'));
 }
 const res=response();await createHandler({query:async()=>{throw Error('postgresql://private-secret');}})({method:'GET'},res);
 assert.equal(res.code,503);assert.ok(!res.body.includes('private-secret'));
});

test('HEAD checks availability without returning the encrypted document',async()=>{
 const res=response();await createHandler({query:async()=>({rows:[row]})})({method:'HEAD'},res);
 assert.equal(res.code,200);assert.equal(res.body,undefined);
});

test('write methods are rejected before any database access',async()=>{
 for(const method of ['POST','PUT','DELETE']){
  const res=response();await createHandler({query:async()=>{throw Error('unexpected query');}})({method},res);
  assert.equal(res.code,405);assert.equal(res.headers.Allow,'GET, HEAD');
 }
});
