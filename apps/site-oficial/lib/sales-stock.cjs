'use strict';
const rules=require('./official-entries.cjs'),tickets=require('./entry-tickets.cjs'),caravans=require('./caravans.cjs'),{capacityFor}=require('./session-capacity.cjs');
const fail=message=>Object.assign(Error(message),{status:503});
function calculate({session,attendees,catalog,state,queriedAt}){
 const target=rules.bySession(session);if(!target||session===rules.LOT.session)throw fail('Selecione uma apresentação oficial para consultar as vendas.');
 if(!rules.catalogMatches(catalog,{...target,category:catalog.tickets?.find(t=>t.prices?.some(p=>String(p.id_ticket)===target.entryId&&String(p.id_ticket_price)===target.priceId))?.title}))throw fail('Catálogo Even3 divergente. Não distribua novas senhas até conferir.');
 const seen=new Set(),confirmed=new Set();let unconfirmed=0;
 for(const p of attendees){
  if(String(p.id_event)!==tickets.EVENT_ID)continue;
  const source=rules.byCatalogCategory(catalog,p.registration_category);if(source?.session!==session)continue;
  const code=tickets.parseTicketCode(String(p.checkin_code||''));if(!code||seen.has(code))throw fail('Lista de ingressos incompleta ou duplicada. Confira antes de vender.');seen.add(code);
  if(typeof p.confirmed!=='boolean')throw fail('Confirmação Even3 não reconhecida. Confira antes de vender.');
  if(p.confirmed===true)confirmed.add(code);else unconfirmed++;
 }
 const cap=capacityFor(session),reservedGroups=caravans.groupsFor(session).filter(g=>caravans.reserved(state,session,g));
 const codesInCaravans=new Set(caravans.list(state).filter(c=>reservedGroups.includes(c.group)).flatMap(c=>c.members.map(m=>m.code)));
 const overlap=[...confirmed].filter(c=>codesInCaravans.has(c)).length;
 const protectedCaravanPlaces=Math.max(0,reservedGroups.length*cap.groupSize-overlap);
 const additionalAdmitted=new Set(state.people.filter(p=>!confirmed.has(p.id)&&!caravans.native(p.id)&&!codesInCaravans.has(p.id)).map(p=>p.id)).size;
 const committed=confirmed.size+protectedCaravanPlaces+additionalAdmitted;
 return {session,queriedAt,source:'Even3 API · consulta completa atual',capacity:cap.total,confirmed:confirmed.size,unconfirmed,protectedCaravanPlaces,reservedGroups,additionalAdmitted,available:Math.max(0,cap.total-committed),overCapacity:committed>cap.total,caravanLists:caravans.list(state).length,estimate:true};
}
function createService({query,even3,now=()=>new Date().toISOString()}){
 async function read(session){
  if(!caravans.DAYS.includes(session))throw Object.assign(Error('Selecione uma data oficial.'),{status:400});
  const [response,catalog,row]=await Promise.all([even3.request('attendees/'),even3.event(),query('SELECT state FROM peniel_ops.session_state WHERE session_date=$1',[session])]);
  const attendees=even3.items(response);
  if(!Array.isArray(response)&&(!Number.isSafeInteger(Number(response.count))||Number(response.count)!==attendees.length))throw fail('Lista Even3 incompleta. Saldo indisponível; não distribua novas senhas.');
  if(!row.rows[0])throw fail('Sessão indisponível.');
  return calculate({session,attendees,catalog,state:row.rows[0].state,queriedAt:now()});
 }
 return {read};
}
module.exports={calculate,createService};
