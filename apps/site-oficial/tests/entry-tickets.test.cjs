const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const tickets=require('../lib/entry-tickets.cjs');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('seis categorias oficiais mapeiam somente para as datas corretas',()=>{
 assert.deepEqual(tickets.ENTRIES.map(x=>x.entryId),['968577','968578','968579','968580','968581','968582']);
 assert.deepEqual(tickets.ENTRIES.map(x=>x.session),['2026-11-09','2026-11-13','2026-11-14','2026-11-19','2026-11-20','2026-11-21']);
 for(const id of ['968141','968467','968468','1098508','0'])assert.equal(tickets.findEntry(id),null);
});
test('QR recebe somente codigo individual, nunca entrada nem URL maliciosa',()=>{
 assert.equal(tickets.parseTicketCode('0012345678'),'0012345678');
 assert.equal(tickets.parseTicketCode('https://www.even3.com.br/checkin?codigo=0012345678'),'0012345678');
 for(const s of ['https://evil.example/checkin?codigo=0012345678','https://even3.com.br.evil.example/?codigo=0012345678','https://even3.com.br/?idIngresso=968577','TESTE','1'.repeat(21)])
  assert.equal(tickets.parseTicketCode(s),null);
});
test('a origem Pluga nunca prova pagamento; divergencias e dias errados bloqueiam',()=>{
 const raw={event_id:'798621',ticket_code:'77472765',participant_id:'100',participant_name:'Pessoa',entry_candidate_id:'968577',source_action:'registration_confirmed'};
 const auth={event_id:'798621',ticket_code:'77472765',participant_id:'100',entry_id:'968577',registration_status:'confirmed',payment_status:'paid',verified_at:'2026-10-20T00:00:00Z',evidence_reference:'external-reconciled-item'};
 assert.equal(tickets.assessAdmission(raw,null,{today:'2026-11-09',enabled:true}).ok,false);
 assert.equal(tickets.assessAdmission(raw,auth,{today:'2026-11-13',enabled:true}).ok,false);
 assert.equal(tickets.assessAdmission(raw,auth,{today:'2026-11-09',enabled:false}).ok,false);
 assert.equal(tickets.assessAdmission(raw,{...auth,participant_id:'999'},{today:'2026-11-09',enabled:true}).ok,false);
 assert.equal(tickets.assessAdmission({...raw,conflict:true},auth,{today:'2026-11-09',enabled:true}).ok,false);
 assert.equal(tickets.assessAdmission(raw,{...auth,payment_status:'refunded'},{today:'2026-11-09',enabled:true}).ok,false);
 assert.equal(tickets.assessAdmission(raw,{...auth,revoked_at:'2026-11-01'},{today:'2026-11-09',enabled:true}).ok,false);
 assert.equal(tickets.assessAdmission(raw,auth,{today:'2026-11-09',enabled:true}).ok,true);
});
test('portaria exige colaborador, Pluga, verificação financeira e bloqueio de uso repetido',()=>{
 const api=source('pages/api/operacao/ingresso.js');
 assert.match(api,/await actor\(req\)/);assert.match(api,/sameOrigin\(req\)/);
 assert.match(api,/cdj_pluga_inscricoes_inbox/);assert.match(api,/entry_authorizations/);
 assert.match(api,/FOR UPDATE/);assert.match(api,/checked_in_at/);
 assert.match(api,/CDJ_ENTRY_ADMISSION_ENABLED/);
 assert.match(api,/entry_map/);
 assert.doesNotMatch(api,/activity_map|activity_id/);
 const ui=source('components/GateTicketScanner.jsx');
 assert.match(ui,/BarcodeDetector/);assert.match(ui,/getUserMedia/);
 assert.match(ui,/\/api\/operacao\/ingresso/);
 assert.match(source('components/OperationTraining.jsx'),/GateTicketScanner session=\{session\}/);
 assert.match(source('next.config.mjs'),/camera=\(self\)/);
});
