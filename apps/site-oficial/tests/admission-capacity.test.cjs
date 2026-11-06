const test=require('node:test'),assert=require('node:assert/strict'),capacity=require('../lib/admission-capacity.cjs');
test('capacity counts pending check-ins and unused day exceptions without counting this ticket twice',async()=>{
 const calls=[];const db={query:async(sql,args)=>{calls.push({sql,args});return {rows:[{total:calls.length===1?2:3}]};}};
 assert.equal(await capacity.reservations(db,'798621','2026-11-13','2026-11-13','12345678'),5);
 assert.equal(calls[0].args[1],'12345678');assert.equal(calls[1].args[3],'12345678');
 assert.match(calls[1].sql,/DISTINCT ON\(ticket_code\)/);assert.match(calls[1].sql,/checked_in_at IS NULL/);assert.match(calls[1].sql,/NOT EXISTS/);
});
