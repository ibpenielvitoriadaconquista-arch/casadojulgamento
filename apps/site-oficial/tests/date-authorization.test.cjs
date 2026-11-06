const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const rules=require('../lib/official-entries.cjs'),ops=require('../lib/operation-training.cjs'),cashAuthorization=require('../lib/cash-authorization.cjs');
const source=fs.readFileSync(path.join(__dirname,'../pages/api/operacao/autorizacoes.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','return async function handler');
const fail=(status,message)=>Object.assign(new Error(message),{status});
function fixture(occupied){
 const original=rules.ENTRIES[1],destination=rules.ENTRIES[2];let reservations=0,writes=0,serial=Promise.resolve();
 const query=async(sql,args)=>{
  if(sql.startsWith('SELECT attendee_id'))return {rows:[{attendee_id:args[1]}]};
  if(sql.startsWith('SELECT state'))return {rows:[{state:{people:Array(occupied).fill({})}}]};
  if(sql.startsWith('SELECT *'))return {rows:[]};
  if(sql.startsWith('INSERT INTO peniel_ops.entry_authorizations')){writes++;return {rows:[]};}
  if(sql.startsWith('INSERT INTO peniel_ops.entry_financial_audit')){reservations++;return {rows:[]};}
  throw Error(sql);
 };
 const transaction=fn=>{const run=serial.then(()=>fn({query}));serial=run.catch(()=>{});return run;};
 const even3={attendee:async id=>({id_attendees:id,checkin_code:id,id_event:'798621',name:'Pessoa teste',registration_category:original.category,confirmed:true}),event:async()=>({id_event:'798621',tickets:[{title:original.category,prices:[{id_ticket:original.entryId,id_ticket_price:original.priceId}]}]})};
 const handler=new Function('actor','fail','sameOrigin','query','transaction','tickets','rules','even3','cashAuthorization','capacity','capacityFor',source)(async()=>({role:'coordenacao',user_id:'coord'}),fail,()=>{},query,transaction,{EVENT_ID:'798621',parseTicketCode:x=>x,bahiaDay:()=>destination.session},rules,even3,cashAuthorization,{reservations:async()=>reservations},ops.capacityFor);
 return {call:async code=>{const res={setHeader(){},status(x){this.code=x;return this;},json(body){this.body=body;this.code??=200;}};await handler({method:'POST',body:{code,action:'authorize_date',session:destination.session,paymentStatus:'paid',evidence:'Ingresso e vagas conferidos presencialmente',confirmed:true}},res);return res;},writes:()=>writes};
}
test('coordination cannot authorize another date when the destination is full',async()=>{const f=fixture(500),r=await f.call('12345678');assert.equal(r.code,409);assert.match(r.body.error,/sem vagas/);assert.equal(f.writes(),0);});
test('concurrent coordination authorizations reserve the last available place only once',async()=>{const f=fixture(499),r=await Promise.all([f.call('12345678'),f.call('12345679')]);assert.deepEqual(r.map(x=>x.code).sort(),[200,409]);assert.equal(f.writes(),1);});
