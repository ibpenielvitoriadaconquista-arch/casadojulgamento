const {test}=require('node:test');const assert=require('node:assert/strict');
const rules=require('../lib/rules.cjs');
test('seis datas oficiais; 22 novembro não vendido',()=>{assert.equal(rules.SESSIONS.length,6);assert(!rules.SESSIONS.some(x=>x.id==='2026-11-22'))});
test('preço e alimento em 2 entradas',()=>{const v=rules.validateOrder({nome:'Maria Souza',whatsapp:'(77) 98888-7777',sessaoId:'2026-11-13',quantidade:2});assert.equal(v.valorCentavos,3000);assert.equal(v.alimentosKg,2);assert.equal(v.whatsapp,'5577988887777')});
test('sessão fora da programação não pode vender',()=>assert.throws(()=>rules.validateOrder({nome:'Maria Souza',whatsapp:'77988887777',sessaoId:'2026-11-22',quantidade:2})));
test('aceita de 1 a 6 ingressos',()=>{for(let q=1;q<=6;q++) assert.equal(rules.validateOrder({nome:'Maria Souza',whatsapp:'77988887777',sessaoId:'2026-11-13',quantidade:q}).valorCentavos,1500*q);for(let q of [-1,0,7,1.2,'2'])assert.throws(()=>rules.validateOrder({nome:'Maria Souza',whatsapp:'77988887777',sessaoId:'2026-11-13',quantidade:q}))});
test('nome e WhatsApp precisam de validação no servidor',()=>{for(let nome of ['', 'X', '<script>', 'x'.repeat(150)])assert.throws(()=>rules.validateOrder({nome,whatsapp:'77988887777',sessaoId:'2026-11-13',quantidade:1}));for(let whatsapp of ['aaa','1234','00 0000000000'])assert.throws(()=>rules.validateOrder({nome:'Maria Souza',whatsapp,sessaoId:'2026-11-13',quantidade:1}))});
test('reserva sempre de 15 minutos',()=>assert.equal(rules.RESERVATION_MINUTES,15));
