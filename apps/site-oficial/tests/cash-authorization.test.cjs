const {test}=require('node:test');const assert=require('node:assert/strict');
const {allowed}=require('../lib/cash-authorization.cjs');
const receipt={action:'authorize',paymentStatus:'paid',received:true,paymentMethod:'dinheiro'};
test('cashier confirms received cash and church Pix only',()=>{
 assert.equal(allowed('caixa','POST',receipt),true);
 assert.equal(allowed('caixa','POST',{...receipt,paymentMethod:'pix_igreja'}),true);
 for(const patch of [{received:false},{paymentStatus:'exempt'},{action:'retry_external'},{action:'confirm_external'},{action:'revoke'},{paymentMethod:'even3'}])assert.equal(allowed('caixa','POST',{...receipt,...patch}),false);
 assert.equal(allowed('caixa','GET',receipt),false);
 for(const role of ['portaria','guia','coordenacao',undefined])assert.equal(allowed(role,'POST',receipt),false);
});
test('management retains financial review and external reconciliation',()=>assert.equal(allowed('geral','POST',{action:'confirm_external'}),true));
