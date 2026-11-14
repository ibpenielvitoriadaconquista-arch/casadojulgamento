'use strict';
const {capacityFor}=require('./session-capacity.cjs');
const SESSIONS = [
  {id:'2026-10-22',label:'Lote 1 · 22–28/10'},
  {id:'2026-11-09',label:'09/11 · 17h'}, {id:'2026-11-13',label:'13/11 · 20h'},
  {id:'2026-11-14',label:'14/11 · 18h'}, {id:'2026-11-19',label:'19/11 · 20h'},
  {id:'2026-11-20',label:'20/11 · 17h'}, {id:'2026-11-21',label:'21/11 · 18h'},
  {id:'2026-11-11',label:'11/11 · TREINAMENTO · CJ-001 a CJ-200'}
];
const ARCHIVED_SESSIONS=['2026-11-09'];
const DEFAULT_SESSION='2026-11-13';
const CIRCUIT_LIMIT=3;
const circuitLimitFor=day=>day==='2026-11-14'?4:CIRCUIT_LIMIT;
const LABELS={forming:'Em formação',closed:'Fechado no salão',called:'Chamado para espera',waiting:'Na sala de espera',circuit:'No circuito',safe:'No ponto seguro',finished:'Finalizado'};
const ROLES={geral:'Painel geral',portaria:'Portaria',caixa:'Caixa',coordenacao:'Coordenação',apoio:'Apoio',telao:'Telão',caravanas:'Administrador de caravanas'};
const ALLOWED={geral:['scan','assign','deliver','undoDelivery','move','close','reopen','call','manualCall','clearManualCall','arrive','start','safe','finish','pause','takeover','guide','reset','addGroup'],portaria:['scan'],caixa:[],caravanas:[],coordenacao:['assign','deliver','undoDelivery','move','addGroup'],apoio:['arrive','start','safe','finish'],telao:['close','reopen','call','manualCall','clearManualCall']};
function freshSession(sessionId=SESSIONS[0].id){return {counter:0,paused:false,coordinator:'Titular',people:[],groups:Array.from({length:capacityFor(sessionId).groups},(_,i)=>({id:'G'+String(i+1).padStart(2,'0'),status:'forming',guide:'',members:[]})),history:[],lastAssignment:null};}
function fresh(){return {schema:5,revision:0,sessions:Object.fromEntries(SESSIONS.map(s=>[s.id,freshSession(s.id)]))};}
function active(s){return s.groups.filter(g=>['circuit','safe'].includes(g.status));}
function wait(s){return s.groups.find(g=>['called','waiting'].includes(g.status));}
// Called and waiting groups reserve a circuit place before entering scene 1.
function occupied(s){return s.groups.filter(g=>['called','waiting','circuit','safe'].includes(g.status));}
function circuitSlots(s,day){
 const limit=circuitLimitFor(day);
 const slots=Array(limit).fill(null),legacy=[];
 for(const g of occupied(s)){if(Number.isInteger(g.circuitSlot)&&g.circuitSlot>=0&&g.circuitSlot<limit&&!slots[g.circuitSlot])slots[g.circuitSlot]=g;else legacy.push(g);}
 for(const g of legacy){const index=slots.indexOf(null);if(index>=0)slots[index]=g;}
 return slots;
}
function callBlock(s,day){
 const limit=circuitLimitFor(day);
 if(s.closedAt)return 'Apresentação encerrada. Histórico disponível somente para consulta.';
 if(s.paused)return 'Movimentações pausadas pela Gestão.';
 if(occupied(s).length>=limit)return (limit===4?'As quatro vagas':'As três vagas')+' estão ocupadas. Aguarde uma finalização na Cena 7.';
 if(wait(s))return 'Aguarde o Apoio 1 receber e iniciar '+wait(s).id+'. A sala de espera está ocupada.';
 return '';
}
function nextToCall(s){return s.groups.find(g=>!g.caravanDeferred&&g.members.length&&['forming','closed'].includes(g.status));}
function summarize(s){return {arrived:s.people.length,pending:s.people.filter(p=>!p.group).length,paper:s.people.filter(p=>p.group&&!p.paperAt).length,active:active(s).length};}
function nextGroupId(s){
 const numbers=s.groups.map(g=>/^G[0-9]+$/.test(g.id)?Number(g.id.slice(1)):NaN);
 if(numbers.some(n=>!Number.isSafeInteger(n)||n<1)||new Set(s.groups.map(g=>g.id)).size!==s.groups.length)throw Error('Numeração dos grupos inválida. Procure a Gestão.');
 const number=Math.max(0,...numbers)+1;
 if(!Number.isSafeInteger(number))throw Error('Não foi possível gerar o próximo grupo.');
 return 'G'+String(number).padStart(2,'0');
}
function apply(db,sessionId,role,action,arg={},now=new Date().toISOString()){
  if(!ALLOWED[role]?.includes(action))throw Error('Este comando pertence a outro posto.');
  if(!SESSIONS.some(s=>s.id===sessionId)||db?.schema!==5)throw Error('Sessão inválida.');
  const capacity=capacityFor(sessionId);
  const next=JSON.parse(JSON.stringify(db));let s=next.sessions[sessionId];
  if(s.closedAt)throw Error('Apresentação encerrada. Histórico disponível somente para consulta.');
  circuitSlots(s,sessionId).forEach((g,index)=>{if(g)g.circuitSlot=index;});
  const group=id=>s.groups.find(g=>g.id===id),person=id=>s.people.find(p=>p.id===id);
  const log=(text)=>{s.history.unshift({at:now,role:ROLES[role],action,text});s.history=s.history.slice(0,500);};
  let message='';
  if(action==='addGroup'){
    if(s.groups.length>=capacity.total)throw Error('Limite de grupos de organização alcançado para esta sessão.');
    const id=nextGroupId(s);
    s.groups.push({id,status:'forming',guide:'',members:[]});
    message=id+' adicionado em formação. A lotação da sessão e o limite por grupo não foram alterados.';
  }else if(action==='scan'){
    if(s.people.length>=capacity.total)throw Error('Limite de '+capacity.total+' espectadores de teste por sessão.');
    if(arg.eventId&&s.people.some(p=>p.eventId===arg.eventId))throw Error('Este QR fictício já foi recebido. Nenhuma pessoa duplicada.');
    const n=++s.counter,names=['Ana','Bruno','Carla','Diego','Elisa','Felipe','Giovana','Hugo','Isabela','João','Larissa','Marcos'];
    const p={id:'TESTE-'+sessionId.slice(5)+'-'+String(n).padStart(3,'0'),name:names[(n-1)%names.length]+' · Teste '+String(n).padStart(3,'0'),family:'F'+String(Math.ceil(n/3)).padStart(3,'0'),group:null,paperAt:null,arrivedAt:now,eventId:arg.eventId||'sim-'+n};
    s.people.push(p);message=p.name+' chegou. Aguardando escolha de grupo no corredor.';
  }else if(action==='assign'){
    const ids=[...new Set(arg.ids||[])],g=group(arg.group);
    if(!ids.length)throw Error('Selecione pelo menos uma pessoa na fila.');
    if(!g||g.status!=='forming')throw Error('Escolha um grupo em formação.');
    const people=ids.map(person);if(people.some(p=>!p||p.group))throw Error('Uma das pessoas já recebeu grupo. Atualize a seleção.');
    if(g.members.length+people.length>capacity.groupSize)throw Error('O grupo não tem vagas para todas as pessoas selecionadas.');
    for(const p of people){p.group=g.id;p.assignedAt=now;g.members.push(p.id);}
    s.lastAssignment={group:g.id,ids,at:now};message=people.map(p=>p.name).join(', ')+' → '+g.id+'. Entregue a senha '+g.id+' e confirme a entrega.';
  }else if(action==='deliver'||action==='undoDelivery'){
    const ids=[...new Set(arg.ids||[])];if(!ids.length)throw Error('Nenhuma pessoa selecionada.');
    const people=ids.map(person);if(people.some(p=>!p?.group||!['forming','closed'].includes(group(p.group)?.status)))throw Error('A senha só pode ser alterada enquanto o grupo está no salão.');
    if(action==='deliver'&&people.some(p=>p.paperAt))throw Error('Uma destas senhas já consta como entregue. Confira a lista.');
    if(action==='undoDelivery'&&(!String(arg.reason||'').trim()||people.some(p=>!p.paperAt)))throw Error('Informe o motivo e selecione uma senha já entregue.');
    people.forEach(p=>{p.paperAt=action==='deliver'?now:null;});
    message=people.map(p=>p.name+' · '+p.group).join(', ')+(action==='deliver'?' — senha entregue.':' — entrega desfeita: '+arg.reason);
  }else if(action==='move'){
    const p=person(arg.id),to=group(arg.group),from=p&&group(p.group);
    if(!p||!from||from.status!=='forming'||!to||to.status!=='forming'||to.id===from.id)throw Error('A troca exige dois grupos diferentes em formação.');
    if(to.members.length>=capacity.groupSize)throw Error('Grupo de destino lotado.');
    if(!String(arg.reason||'').trim())throw Error('Informe o motivo da troca.');
    if(p.paperAt&&!arg.paperReturned)throw Error('Recolha a senha anterior antes de trocar de grupo.');
    from.members=from.members.filter(id=>id!==p.id);to.members.push(p.id);p.group=to.id;p.paperAt=null;p.assignedAt=now;
    s.lastAssignment={group:to.id,ids:[p.id],at:now};message=p.name+': '+from.id+' → '+to.id+'. Entregue a nova senha. Motivo: '+arg.reason;
  }else if(action==='close'){
    const g=group(arg.group);if(!g||g.status!=='forming'||!g.members.length)throw Error('O grupo precisa estar em formação e ter ao menos uma pessoa.');
    if(g.members.some(id=>!person(id).paperAt))throw Error('Confirme a entrega de todas as senhas antes de fechar o grupo.');
    g.status='closed';g.closedAt=now;message=g.id+' fechado com '+g.members.length+'/'+capacity.groupSize+'. Todos receberam senha.'+(arg.caravanMissingReason?' Fechamento sem todos os integrantes previstos: '+String(arg.caravanMissingReason).trim().slice(0,300):'');
  }else if(action==='reopen'){
    const g=group(arg.group);if(!g||g.status!=='closed')throw Error('Só é possível reabrir um grupo ainda fechado no salão.');
    g.status='forming';message=g.id+' reaberto no salão.';
  }else if(action==='manualCall'){
    const g=group(arg.group);if(!g||!g.members.length||!['forming','closed'].includes(g.status))throw Error('Selecione um grupo que ainda está no salão.');
    s.manualCall={group:g.id,at:now};message=g.id+' anunciado manualmente, sem reservar vaga no circuito.';
  }else if(action==='clearManualCall'){
    delete s.manualCall;message='Anúncio manual retirado do telão.';
  }else if(action==='call'){
    const g=group(arg.group);if(s.paused)throw Error('Movimentações pausadas pelo painel geral.');
    if(!g||g.status!=='closed')throw Error('Feche o grupo antes de chamar.');
    if(g.caravanDeferred)throw Error('Retome a prioridade deste grupo antes de chamar.');
    const blocked=callBlock(s,sessionId);if(blocked)throw Error(blocked);
    if(g.members.some(id=>!person(id).paperAt))throw Error('Há senha pendente de entrega neste grupo.');
    const earlier=s.groups.slice(0,s.groups.indexOf(g)).find(x=>!x.caravanDeferred&&x.members.length&&['forming','closed'].includes(x.status));
    if(earlier)throw Error(earlier.id+' ainda aguarda no salão. Respeite a ordem dos grupos.');
    const slots=circuitSlots(s,sessionId);slots.forEach((existing,index)=>{if(existing)existing.circuitSlot=index;});const slot=arg.slot??slots.indexOf(null);if(!Number.isInteger(slot)||slot<0||slot>=slots.length||slots[slot])throw Error('Esta vaga foi ocupada. Atualize o painel.');g.circuitSlot=slot;g.status='called';g.calledAt=now;delete s.manualCall;message=g.id+' chamado no telão. Sala de espera reservada.';
  }else if(action==='arrive'){
    const g=group(arg.group);if(s.paused)throw Error('Movimentações pausadas.');if(!g||g.status!=='called')throw Error('Aguarde a chamada do operador do Telão.');
    g.status='waiting';g.arrivedAt=now;if(s.supportSignal)s.supportSignal={...s.supportSignal,acknowledgedAt:now,receivedGroup:g.id};message=g.id+' recebido pelo apoio na sala de espera.';
  }else if(action==='start'){
    const g=group(arg.group);if(s.paused)throw Error('Novas partidas pausadas.');if(!g||g.status!=='waiting')throw Error('Confirme o grupo na sala de espera primeiro.');
    if(!arg.physicallySafe)throw Error('O apoio precisa confirmar as condições físicas de segurança.');
    if(active(s).length>=circuitLimitFor(sessionId))throw Error('O circuito está cheio. Aguarde uma finalização.');
    if(active(s).some(x=>x.status==='circuit'))throw Error('O grupo em percurso precisa confirmar o ponto seguro.');
    const previous=s.groups.slice(0,s.groups.indexOf(g)).filter(x=>x.members.length&&!x.caravanDeferred);
    if(previous.some(x=>!['safe','finished'].includes(x.status)))throw Error('O grupo anterior precisa confirmar o ponto seguro.');
    g.status='circuit';g.startedAt=now;message=g.id+' iniciou por confirmação do apoio. Sala de espera LIVRE.';
  }else if(action==='safe'){
    const g=group(arg.group);if(!g||g.status!=='circuit')throw Error('Grupo não está em percurso.');
    g.status='safe';g.safeAt=now;s.supportSignal={group:g.id,at:now,acknowledgedAt:null};message=g.id+' no ponto seguro. Continua ocupando uma vaga do circuito.';
  }else if(action==='finish'){
    const g=group(arg.group);if(!g||g.status!=='safe')throw Error('Registre o ponto seguro antes de finalizar.');
    g.status='finished';g.finishedAt=now;message=g.id+' finalizado pelo apoio. Vaga do circuito liberada.';
  }else if(action==='guide'){
    const g=group(arg.group);if(!g||!['forming','closed'].includes(g.status))throw Error('Defina o apoio antes da chamada.');
    const name=String(arg.name||'').trim().slice(0,60);if(!name)throw Error('Informe um nome do apoio fictício.');g.guide=name;message=g.id+' atribuído a '+name+'.';
  }else if(action==='pause'){
    s.paused=!s.paused;message=s.paused?'Novos deslocamentos PAUSADOS. Grupos no circuito continuam assistidos pela equipe de apoio.':'Movimentos retomados após conferência da equipe.';
  }else if(action==='takeover'){
    s.coordinator=s.coordinator==='Titular'?'Substituto':'Titular';s.paused=true;message=s.coordinator+' assumiu. Movimentos pausados até conferência.';
  }else if(action==='reset'){
    next.sessions[sessionId]=freshSession(sessionId);s=next.sessions[sessionId];message='Treinamento desta sessão zerado. Nenhum ingresso real foi alterado.';
  }else throw Error('Comando não reconhecido.');
  log(message);next.revision++;return {db:next,message};
}
module.exports={ARCHIVED_SESSIONS,DEFAULT_SESSION,occupied,circuitSlots,callBlock,nextToCall,nextGroupId,capacityFor,circuitLimitFor,CIRCUIT_LIMIT,SESSIONS,LABELS,ROLES,ALLOWED,fresh,freshSession,active,wait,summarize,apply};
