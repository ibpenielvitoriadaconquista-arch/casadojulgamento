'use strict';
// Isolated fixtures only: this module never imports db.js, process credentials for Even3,
// or a production transport. The same admission and authorization services run in memory.
const ops=require('./operation-training.cjs'),rules=require('./official-entries.cjs'),ai=require('./operations-assistant.cjs'),operator=require('./operator-authorizations.cjs'),admission=require('./official-admission.cjs'),confirmation=require('./assistant-confirmation.cjs'),capacity=require('./admission-capacity.cjs');
const USER={role:'geral',user_id:'homologacao-isolada'},CODE='99000001',SESSION=rules.LOT.session,THREAD='homologacao-isolada';
const ensure=(value,message)=>{if(!value)throw Error(message);};
const reject=async(fn)=>{try{await fn();}catch{return;}throw Error('Ação deveria ser recusada.');};
function fixture({entry=rules.LOT,attempt=null,confirmed=true,revoked=false,used=false,occupied=0}={}){
 const state={now:'2026-10-22T21:00:00.000Z',auth:{event_id:'798621',ticket_code:CODE,entry_id:entry.entryId,participant_id:'qa-attendee',participant_name:'Pessoa Fictícia Homologação',registration_status:'confirmed',payment_status:'pending',evidence_reference:`even3-confirmed-registration:798621:qa-attendee:${entry.entryId}`,verified_at:'2026-10-22',revoked_at:revoked?'2026-10-22':null,checked_in_at:used?'2026-10-22':null},attempt:attempt?{status:attempt,session_date:SESSION,requested_at:'2026-10-22T20:58:00.000Z',entry_id:entry.entryId,attendee_id:'qa-attendee',participant_name:'Pessoa Fictícia Homologação',requested_by:USER.user_id}:null,session:ops.freshSession(SESSION),revision:0,audit:[],proposals:[],upstreamSends:0,authorizationRequests:0};
 state.session.people=Array.from({length:occupied},(_,i)=>({id:'occupied-'+i,group:null}));
 let serial=Promise.resolve();
 const query=async(sql,args=[])=>{
  if(sql.startsWith('SELECT attendee_id'))return {rows:[{attendee_id:'qa-attendee'}]};
  if(sql.startsWith('SELECT action,evidence'))return {rows:state.audit.filter(a=>['authorize_date','revoke'].includes(a.action)).slice(-1)};
  if(sql.startsWith('SELECT action,evidence,created_at'))return {rows:state.audit.slice(-6).reverse()};
  if(sql.includes('count(*)')&&sql.startsWith('SELECT count(*)::int AS total FROM peniel_ops.entry_checkins'))return {rows:[{total:state.attempt&&state.attempt.status!=='admitted'&&args[1]!==CODE?1:0}]};
  if(sql.includes('count(*)')){const last=state.audit.filter(a=>['authorize_date','revoke'].includes(a.action)).at(-1);return {rows:[{total:last?.action==='authorize_date'&&!state.auth.revoked_at&&!state.auth.checked_in_at&&!state.attempt&&args[3]!==CODE?1:0}]};}
  if(sql.startsWith('SELECT')&&sql.includes('FROM peniel_ops.entry_authorizations'))return {rows:state.auth?[structuredClone(state.auth)]:[]};
  if(sql.startsWith('SELECT')&&sql.includes('FROM peniel_ops.entry_checkins'))return {rows:state.attempt?[structuredClone(state.attempt)]:[]};
  if(sql.startsWith('SELECT state'))return {rows:[{state:structuredClone(state.session),revision:state.revision,updated_at:state.now}]};
  if(sql.startsWith('INSERT INTO peniel_ops.entry_authorizations')){
   if(sql.includes('DO NOTHING'))return {rows:[]};
   Object.assign(state.auth,{entry_id:args[2],participant_id:args[3],participant_name:args[4],payment_status:args[5],evidence_reference:args[6],verified_at:state.now,revoked_at:null});return {rows:[]};
  }
  if(sql.startsWith('INSERT INTO peniel_ops.entry_financial_audit')){state.audit.push({action:args[3],actor_id:args[2],evidence:JSON.parse(args[4]),created_at:state.now});return {rows:[]};}
  if(sql.startsWith('INSERT INTO peniel_ops.assistant_proposals')){state.proposals.push({id:args[0],thread_id:args[1],owner_id:args[2],payload:JSON.parse(args[3]),expires_at:args[4],status:'pending'});return {rows:[]};}
  if(sql.startsWith('SELECT id FROM peniel_ops.assistant_proposals'))return {rows:state.proposals.filter(p=>p.owner_id===args[0]&&p.thread_id===args[1]&&p.payload.code===args[2]&&p.payload.target===args[3]&&(p.payload.kind||'date')===args[4]&&p.status==='pending'&&p.expires_at>state.now).slice(0,2).map(p=>({id:p.id}))};
  if(sql.startsWith('UPDATE peniel_ops.assistant_proposals')){const p=state.proposals.find(p=>p.id===args[0]);if(sql.includes('RETURNING payload')){if(!p||p.owner_id!==args[1]||p.status!=='pending'||p.expires_at<=state.now)return {rows:[]};p.status='processing';return {rows:[{payload:structuredClone(p.payload)}]};}if(p)p.status=args[1]||'rejected';return {rows:[]};}
  if(sql.startsWith('DELETE FROM peniel_ops.entry_checkins')){state.attempt=null;return {rows:[]};}
  if(sql.startsWith('INSERT INTO peniel_ops.entry_checkins')){state.attempt={event_id:args[0],ticket_code:args[1],entry_id:args[2],attendee_id:args[3],participant_name:args[4],session_date:args[5],status:'sending',requested_at:args[6],requested_by:args[7]};return {rows:[]};}
  if(sql.startsWith('UPDATE peniel_ops.entry_checkins')){state.attempt.status=sql.includes("status='admitted'")?'admitted':sql.includes("status='uncertain'")?'uncertain':'confirmed';return {rows:[]};}
  if(sql.startsWith('UPDATE peniel_ops.entry_authorizations')){state.auth.checked_in_at=state.now;return {rows:[]};}
  if(sql.startsWith('UPDATE peniel_ops.session_state')){state.session=JSON.parse(args[1]);state.revision=args[2];return {rows:[]};}
  throw Error('Consulta não prevista na homologação isolada.');
 };
 const transaction=fn=>{const run=serial.then(async()=>{const before=structuredClone(state);try{return await fn({query});}catch(e){Object.assign(state,before);throw e;}});serial=run.catch(()=>{});return run;};
 const even3={attendee:async()=>({id_event:'798621',id_attendees:'qa-attendee',checkin_code:CODE,name:'Pessoa Fictícia Homologação',registration_category:entry.category,confirmed}),event:async()=>({id_event:'798621',tickets:[{title:entry.category,prices:[{id_ticket:entry.entryId,id_ticket_price:entry.priceId}]}]}),checkin:async()=>{state.upstreamSends++;return 'OK';}};
 const now=()=>state.now,service=admission.createService({query,transaction,even3,now}),authorization=operator.createService({query,transaction,even3,now});
 const tools=ai.createTools({query,admission:service,trainingService:{lookup:async()=>{throw Error('Não disponível neste cenário.');}},even3,now});
 const ctx={user:USER,threadId:THREAD,session:SESSION,proposals:[]};
 const prepare=async(kind)=>{const r=await tools.run(kind==='date'?'preparar_excecao_data':'preparar_acao_administrativa',kind==='date'?{codigo:CODE,sessao:SESSION}:{codigo:CODE,sessao:SESSION,acao:kind},ctx);return r.data.proposal;};
 // execute() is async: resolve it before constructing a simulated HTTP response.
 const transport=async(url,options)=>{ensure(url==='https://www.ibpeniel.com/api/operacao/autorizacoes','Destino inválido.');state.authorizationRequests++;try{const result=await authorization.execute(USER,JSON.parse(options.body));return {ok:true,status:200,json:async()=>result};}catch(e){return {ok:false,status:e.status||503,json:async()=>({error:e.status?e.message:'Falha controlada.'})};}};
 const confirm=p=>confirmation.confirm({query,user:USER,proposalId:p.id,paymentStatus:'paid',evidence:'HOMOLOGAÇÃO ISOLADA: conferência fictícia',token:'not-a-real-token',fetcher:transport});
 return {state,query,transaction,even3,now,service,authorization,tools,ctx,prepare,confirm};
}
async function run(){
 const checks=[];async function check(name,fn){try{await fn();checks.push({name,status:'pass'});}catch(e){checks.push({name,status:'fail',reason:e.message});}}
 await check('Diagnóstico distingue confirmação de inscrição e dinheiro recebido',async()=>{const f=fixture();const r=await f.tools.run('diagnosticar_ingresso',{codigo:CODE,sessao:SESSION},f.ctx);ensure(r.data.financialBasis.includes('sem prova'),'Base financeira incorreta.');ensure(f.state.upstreamSends===0,'Enviou credenciamento.');});
 await check('Conferência financeira registra gestor e evidência, sem admissão',async()=>{const f=fixture(),p=await f.prepare('payment');ensure((await f.confirm(p)).status==='authorized','Não confirmou.');ensure(f.state.auth.payment_status==='paid'&&f.state.audit[0].actor_id===USER.user_id,'Auditoria ausente.');ensure(!f.state.upstreamSends&&!f.state.session.people.length,'Admissão indevida.');});
 await check('Exceção de data e duas portarias: uma admissão e um envio',async()=>{const f=fixture({entry:rules.ENTRIES[1]}),p=await f.prepare('date');ensure((await f.confirm(p)).status==='authorized','Não confirmou.');const r=await Promise.allSettled([f.service.admit(CODE,SESSION,USER),f.service.admit(CODE,SESSION,USER)]);ensure(r.filter(x=>x.status==='fulfilled'&&x.value.admitted).length===1&&f.state.upstreamSends===1&&f.state.session.people.length===1,'Duplicou entrada.');});
 await check('Even3 já credenciou: recuperar sem novo envio',async()=>{const f=fixture({attempt:'uncertain'}),p=await f.prepare('external_confirmed');ensure((await f.confirm(p)).status==='authorized','Não confirmou.');await f.service.admit(CODE,SESSION,USER);ensure(f.state.session.people.length===1&&!f.state.upstreamSends,'Reenviou ou não admitiu.');});
 await check('Even3 não credenciou: habilita nova tentativa, sem reenvio automático',async()=>{const f=fixture({attempt:'uncertain'}),p=await f.prepare('external_retry');ensure((await f.confirm(p)).status==='authorized'&&!f.state.attempt&&!f.state.upstreamSends,'Reenviou automaticamente.');ensure(f.state.audit[0].evidence.previousAttempt.status==='uncertain','Perdeu histórico.');await f.service.admit(CODE,SESSION,USER);ensure(f.state.upstreamSends===1&&f.state.session.people.length===1,'Portaria não retomou.');});
 await check('Ficha só pode ser confirmada uma vez, inclusive simultaneamente',async()=>{const f=fixture(),p=await f.prepare('payment');const r=await Promise.allSettled([f.confirm(p),f.confirm(p)]);ensure(r.filter(x=>x.status==='fulfilled'&&x.value.status==='authorized').length===1&&f.state.authorizationRequests===1,'Confirmou duas vezes.');});
 await check('Inscrição não confirmada não recebe autorização financeira',async()=>{const f=fixture({confirmed:false});await reject(()=>f.prepare('payment'));ensure(!f.state.audit.length,'Alterou inscrição pendente.');});
 for(const mode of ['used','revoked'])await check(mode==='used'?'Ingresso usado permanece bloqueado':'Revogação permanece bloqueada',async()=>{const f=fixture({[mode]:true});await reject(()=>f.prepare('payment'));});
 await check('Sessão lotada bloqueia exceção de data',async()=>{const f=fixture({entry:rules.ENTRIES[1],occupied:300});await reject(()=>f.prepare('date'));});
 await check('Tentativa recente exige um minuto de conferência',async()=>{const f=fixture({attempt:'uncertain'});f.state.attempt.requested_at=f.state.now;await reject(()=>f.prepare('external_confirmed'));});
 await check('Tentativa alterada após a ficha é recusada',async()=>{const f=fixture({attempt:'uncertain'}),p=await f.prepare('external_retry');f.state.attempt.requested_at='2026-10-22T20:57:00.000Z';ensure((await f.confirm(p)).status==='rejected','Aceitou ficha desatualizada.');ensure(f.state.attempt,'Removeu tentativa diferente.');});
 await check('Ficha expirada não executa ação',async()=>{const f=fixture(),p=await f.prepare('payment');f.state.now='2026-10-22T21:06:00.000Z';await reject(()=>f.confirm(p));ensure(!f.state.authorizationRequests,'Enviou ficha expirada.');});
 await check('Resposta incerta consome ficha e não repete envio',async()=>{const f=fixture(),p=await f.prepare('payment');let sends=0;const args={query:f.query,user:USER,proposalId:p.id,paymentStatus:'paid',evidence:'Conferência fictícia controlada',token:'fake',fetcher:async()=>{sends++;throw Error('timeout');}};ensure((await confirmation.confirm(args)).status==='uncertain','Não reteve incerteza.');await reject(()=>confirmation.confirm(args));ensure(sends===1,'Reenviou resposta incerta.');});
 await check('Conferência financeira preserva exceção de data e reserva',async()=>{const f=fixture({entry:rules.ENTRIES[1]});await f.confirm(await f.prepare('date'));await f.confirm(await f.prepare('payment'));ensure((await f.service.lookup(CODE,SESSION)).eligible,'Perdeu exceção.');ensure(await capacity.reservations({query:f.query},'798621',SESSION,SESSION,'other')===1,'Perdeu reserva.');});
 await check('Outro posto não prepara ação administrativa',async()=>{const f=fixture();await reject(()=>f.tools.run('preparar_acao_administrativa',{codigo:CODE,sessao:SESSION,acao:'payment'},{...f.ctx,user:{role:'portaria',user_id:'other'}}));});
 await check('Comando não escolhe outra ação por engano',async()=>{const f=fixture(),p=await f.prepare('payment');await reject(()=>confirmation.findProposal({query:f.query,user:USER,threadId:THREAD,session:SESSION,command:confirmation.parse('LIBERAR '+CODE+' PAGO Conferência fictícia individual')}));ensure(f.state.proposals.find(x=>x.id===p.id).status==='pending','Consumiu ficha de outro tipo.');});
 return {mode:'isolated_in_memory',clock:'2026-10-22 · Lote 1 simulado',productionWrites:0,realEven3Requests:0,checks,passed:checks.filter(x=>x.status==='pass').length,total:checks.length,ok:checks.every(x=>x.status==='pass')};
}
async function runWithAI({apiKey,model}){
 const f=fixture(),results=[];
 for(const [label,prompt,expected] of [['Diagnóstico com ferramenta real do agente','Homologação isolada com pessoa fictícia. Use diagnosticar_ingresso para o código 99000001 na sessão 2026-10-22. Explique a base financeira sem autorizar nada.','diagnosticar_ingresso'],['Preparação de conferência financeira sem execução','Homologação isolada: prepare uma conferência financeira individual para o código 99000001 na sessão 2026-10-22 usando preparar_acao_administrativa com acao payment. Não confirme: aguarde o gestor.','preparar_acao_administrativa']]){
  const a=await ai.chat({message:prompt,history:[],session:SESSION,user:USER,threadId:THREAD,tools:f.tools,apiKey,model,now:f.now});
  results.push({name:label,status:a.sources.some(s=>s.tool===expected)&&f.state.authorizationRequests===0&&f.state.upstreamSends===0?'pass':'fail',response:a.text,sources:a.sources,usage:a.usage});
 }
 return {mode:'live_openai_with_isolated_tools',model,checks:results,ok:results.every(x=>x.status==='pass'),productionWrites:0,realEven3Requests:0};
}
module.exports={run,runWithAI,fixture};
