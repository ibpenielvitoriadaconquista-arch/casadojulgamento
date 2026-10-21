'use strict';
const checkout=require('./even3-checkout.cjs');
const entries=require('./entry-tickets.cjs');
const EVENT_ID='798621';
function entryFromCategory(category){
 const text=String(category||'').normalize('NFC').trim();
 const match=checkout.ENTRIES.find(item=>'Casa do Julgamento — '+item.date===text);
 return match?entries.findEntry(match.ticket):null;
}
function fromApiRows(rows,code){
 if(!Array.isArray(rows)||!rows.length)return null;
 const main=rows[0];
 const signature=p=>[p.event_id,p.attendee_id,p.participant_name,p.category_name,p.is_confirmed].map(x=>String(x??'')).join('|');
 const conflict=rows.length!==1||rows.some(row=>signature(row)!==signature(main));
 const entry=entryFromCategory(main.category_name);
 return {
  event_id:String(main.event_id||''),ticket_code:String(code||''),
  participant_id:String(main.attendee_id||''),participant_name:String(main.participant_name||'').trim(),
  ticket_category:String(main.category_name||''),
  entry_candidate_id:entry?.entryId||'',
  source_action:main.is_confirmed===true?'registration_confirmed':'unconfirmed',
  conflict
 };
}
module.exports={EVENT_ID,entryFromCategory,fromApiRows};
