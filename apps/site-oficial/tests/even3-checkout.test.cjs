const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {ENTRIES,EVENT_ID,EVENT_SLUG,byDay,buildCheckoutUrl}=require('../lib/even3-checkout.cjs');
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('seis datas com IDs distintos de entrada e horários de portões',()=>{
 assert.equal(EVENT_ID,'798621');
 assert.equal(ENTRIES.length,6);
 assert.equal(new Set(ENTRIES.map(s=>s.dia)).size,6);
 assert.equal(new Set(ENTRIES.map(s=>s.ticket)).size,6);
 assert.deepEqual(ENTRIES.map(s=>s.dia),['09-11','13-11','14-11','19-11','20-11','21-11']);
 assert.deepEqual(ENTRIES.map(s=>s.time),['17h','20h','18h','20h','17h','18h']);
});
test('cada data vai a uma entrada Even3 específica, não ao evento geral',()=>{
 for(const s of ENTRIES){
  assert.equal(byDay(s.dia),s);
  const url=new URL(buildCheckoutUrl(s.ticket));
  assert.equal(url.origin,'https://www.even3.com.br');
  assert.equal(url.pathname,'/auxcheckout/redirect');
  assert.equal(url.searchParams.get('urlEvento'),EVENT_SLUG);
  assert.equal(url.searchParams.get('idIngresso'),s.ticket);
  assert.equal(url.searchParams.get('lang'),'pt');
 }
 assert.equal(byDay('07-11'),null);
});
test('IDs inválidos não geram checkout',()=>{
 for(const id of ['',0,'-1','https://evil.test',null,'1&foo=bar'])assert.throws(()=>buildCheckoutUrl(id));
});
test('interface não instrui atividades e orienta conferir a entrada antes do pagamento',()=>{
 assert.doesNotMatch(src('pages/ingressos/[dia].jsx'),/selecione\s+(?:a\s+)?atividade|inscrição é geral|pré-seleciona a atividade/i);
 assert.match(src('pages/ingressos/[dia].jsx'),/confira na Even3/i);
 assert.match(src('pages/ingressos/[dia].jsx'),/portões/i);
 assert.match(src('pages/ingressos.jsx'),/disponibilidade/i);
});
test('idIngresso do link não representa código individual de credenciamento',()=>{
 assert.match(src('lib/even3-checkout.cjs'),/idIngresso.*não é data.inscricao.id nem inscricao.codigo/);
});
