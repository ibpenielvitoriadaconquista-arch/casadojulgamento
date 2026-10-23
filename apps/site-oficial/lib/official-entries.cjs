'use strict';
const tickets=require('./entry-tickets.cjs');
const LOT={entryId:'968141',priceId:'1097995',session:'2026-10-22',label:'Lote 1 · 22–23/10',category:'Ingresso Geral - 1º Lote',days:['2026-10-22','2026-10-23']};
const ENTRIES=[LOT,...tickets.ENTRIES.map((e,i)=>({...e,priceId:String(1098508+i),category:'Casa do Julgamento — '+e.session.slice(8)+'/'+e.session.slice(5,7)+'/2026',days:[e.session]}))];
const bySession=s=>ENTRIES.find(e=>e.session===s)||null;
const byCategory=s=>ENTRIES.find(e=>e.category===String(s||'').normalize('NFC').trim())||null;
function validate(p,entry,today=tickets.bahiaDay()){
 if(!entry||!p||String(p.id_event)!==tickets.EVENT_ID||String(p.registration_category||'').normalize('NFC').trim()!==entry.category)return 'Ingresso de outra entrada ou evento.';
 if(p.confirmed!==true)return 'Inscrição não confirmada ou cancelada na Even3.';
 if(!p.id_attendees||!p.name||!tickets.parseTicketCode(String(p.checkin_code||'')))return 'Identificação individual incompleta.';
 if(!entry.days.includes(today))return 'Entrada permitida somente em '+entry.label+'.';
 return null;
}
function catalogMatches(event,entry){return String(event?.id_event)===tickets.EVENT_ID&&Array.isArray(event.tickets)&&event.tickets.filter(t=>String(t.title||'').normalize('NFC').trim()===entry.category&&Array.isArray(t.prices)&&t.prices.some(p=>String(p.id_ticket)===entry.entryId&&String(p.id_ticket_price)===entry.priceId)).length===1;}
module.exports={ENTRIES,LOT,bySession,byCategory,validate,catalogMatches};
