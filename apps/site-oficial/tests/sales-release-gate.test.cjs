const {test}=require('node:test');
const assert=require('node:assert/strict');
const {salesReleaseEnabled}=require('../lib/release-gate.cjs');

test('checkout stays closed when release flag is missing',()=>{
 assert.equal(salesReleaseEnabled({VERCEL_ENV:'production'}),false);
 assert.equal(salesReleaseEnabled({}),false);
});

test('preview cannot expose paid checkout even if a flag is accidentally set',()=>{
 assert.equal(salesReleaseEnabled({VERCEL_ENV:'preview',CDJ_SALES_RELEASE_APPROVED:'true'}),false);
 assert.equal(salesReleaseEnabled({VERCEL_ENV:'development',CDJ_SALES_RELEASE_APPROVED:'true'}),false);
});

test('only explicitly approved Production opens the checkout gate',()=>{
 assert.equal(salesReleaseEnabled({VERCEL_ENV:'production',CDJ_SALES_RELEASE_APPROVED:'true'}),true);
 assert.equal(salesReleaseEnabled({VERCEL_ENV:'production',CDJ_SALES_RELEASE_APPROVED:'false'}),false);
 assert.equal(salesReleaseEnabled({VERCEL_ENV:'production',CDJ_SALES_RELEASE_APPROVED:'TRUE'}),false);
});
