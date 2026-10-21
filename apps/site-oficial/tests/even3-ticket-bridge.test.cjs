'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {entryFromCategory,fromApiRows}=require('../lib/even3-ticket-bridge.cjs');
test('Even3 API category recognizes six official dates',()=>{
 const arr=[['09/11/2026','968577'],['13/11/2026','968578'],['14/11/2026','968579'],['19/11/2026','968580'],['20/11/2026','968581'],['21/11/2026','968582']];
 for(const [d,id] of arr)assert.equal(entryFromCategory('Casa do Julgamento — '+d)?.entryId,id);
});
test('reject TESTE, copied and generic categories',()=>{
 for(const category of ['TESTE','Cópia de TESTE','Ingresso Geral - 1º Lote','Casa do Julgamento — 12/11/2026',''])assert.equal(entryFromCategory(category),null);
});
test('never map category ids as individual checkin codes',()=>{
 assert.equal(fromApiRows([{event_id:'798621',attendee_id:'1234',participant_name:'Pessoa',category_name:'Casa do Julgamento — 09/11/2026',is_confirmed:true}], '77572538').entry_candidate_id,'968577');
});
test('reject inconsistent duplicate API snapshots',()=>{
 const p={event_id:'798621',attendee_id:'1',participant_name:'Pessoa A',category_name:'Casa do Julgamento — 09/11/2026',is_confirmed:true};
 assert.equal(fromApiRows([p,{...p,participant_name:'Pessoa B'}],'77572538').conflict,true);
 assert.equal(fromApiRows([p,p],'77572538').conflict,true);
});
test('missing or pending attendee never treated as confirmed',()=>{
 const p={event_id:'798621',attendee_id:'1',participant_name:'Pessoa',category_name:'Casa do Julgamento — 09/11/2026',is_confirmed:false};
 assert.equal(fromApiRows([p],'77572538').source_action,'unconfirmed');
 assert.equal(fromApiRows([],'77572538'),null);
});