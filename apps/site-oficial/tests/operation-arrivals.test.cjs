const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ops=require('../lib/operation-training.cjs'),live=require('../lib/operation-live.cjs');
const source=fs.readFileSync(path.join(__dirname,'../lib/operation-arrivals.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export async function acceptActivityCheckin','return async function acceptActivityCheckin');
function setup({payment='paid',status='confirmed',activity='confirmed',mapped='2026-11-09'}={}){
 let row={state:ops.freshSession(),revision:0},writes=0;
 const registration={participant_id:'p1',registration_id:'r1',participant_name:'Teste',activity_id:'a1',registration_status:status,activity_status:activity,payment_status:payment};
 const query=async(sql,args)=>{
  if(sql.includes('SELECT session_date'))return {rows:mapped?[{session_date:mapped}]:[]};
  if(sql.startsWith('SELECT state'))return {rows:[row]};
  if(sql.startsWith('SELECT *'))return {rows:[registration]};
  if(sql.startsWith('UPDATE peniel_ops.session_state')){writes++;row={state:JSON.parse(args[1]),revision:args[2]};}
  return {rows:[]};
 };
 const accept=new Function('transaction','live',source)(fn=>fn({query}),live);
 return {accept,writes:()=>writes,row:()=>row};
}
const payload={eventId:'798621',registrationId:'r1',activityId:'a1',occurredAt:'2026-11-09T20:00:00Z'};
test('checkin repetido cria uma chegada na fila, sem atribuir grupo',async()=>{
 const x=setup();assert.equal((await x.accept(payload)).duplicate,false);assert.equal((await x.accept(payload)).duplicate,true);assert.equal(x.writes(),1);assert.equal(x.row().state.people[0].group,null);
});
test('checkin de outro dia, atividade desconhecida ou sem ID não admite',async()=>{
 await assert.rejects(setup().accept({...payload,occurredAt:'2026-11-10T20:00:00Z'}));
 await assert.rejects(setup({mapped:null}).accept(payload));
 await assert.rejects(setup().accept({...payload,activityId:undefined}));
});
test('inscrição confirmada sem pagamento não libera; cancelamentos bloqueiam',async()=>{
 for(const config of [{payment:'unknown'},{payment:'pending'},{payment:'refunded'},{status:'cancelled'},{activity:'cancelled'}]){
  const x=setup(config);await assert.rejects(x.accept(payload));assert.equal(x.writes(),0);
 }
});
