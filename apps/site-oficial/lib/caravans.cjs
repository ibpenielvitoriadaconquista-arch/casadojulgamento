'use strict';
// Stored in the existing session JSON; mutations share its revision and row lock.
const DAYS=['2026-11-09','2026-11-13','2026-11-14','2026-11-19','2026-11-20','2026-11-21'];
const GROUPS=['G06','G07','G08'];
const enabled=day=>DAYS.includes(day);
const reserved=(s,day,id)=>enabled(day)&&GROUPS.includes(id)&&!(s.caravanReleased||[]).includes(id);
const list=s=>s.caravans||[];
const native=code=>/^CAR-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(code||''));
const phone=value=>String(value||'').replace(/\D/g,'');
const bahiaDay=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
function identity(s,code){
 const c=list(s).find(c=>c.members.some(m=>m.code===String(code)));
 return c?{id:c.id,name:c.name,city:c.city,group:c.group}:null;
}
function text(value,label,max=100,optional=false){
 const x=String(value||'').trim();
 if((!optional&&x.length<2)||x.length>max||/[<>\x00-\x1f]/.test(x))throw Error('Confira '+label+'.');
 return x;
}
function compatible(s,day,p,group){
 const c=identity(s,p.id);
 return c?reserved(s,day,group)&&c.group===group:!reserved(s,day,group);
}
function handle(s,day,action,arg,now){
 if(!enabled(day))throw Error('Caravanas disponíveis nas seis apresentações de novembro.');
 s.caravans??=[];
 if(action==='caravanSave'){
  const old=s.caravans.find(c=>c.id===arg.id);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(arg.id||'')))throw Error('Identificador da caravana inválido.');
  const group=s.groups.find(g=>g.id===arg.group);
  if(!group||!reserved(s,day,group.id)||group.status!=='forming')throw Error('Escolha G06, G07 ou G08 reservado e em formação.');
  if(!Array.isArray(arg.members)||!arg.members.length||arg.members.length>25)throw Error('Cadastre entre 1 e 25 integrantes por lista. Divida caravanas maiores entre os grupos.');
  const members=arg.members.map(m=>({code:String(m.code||'').trim(),name:text(m.name,'o nome do integrante',150),phone:phone(m.phone),source:native(m.code)?'native':'even3'}));
  const codes=new Set();
  for(const m of members){
   if((!native(m.code)&&!/^[0-9]{6,20}$/.test(m.code))||codes.has(m.code))throw Error('Use identificadores individuais distintos e válidos.');
   if(m.phone&&(m.phone.length<10||m.phone.length>15))throw Error('Informe telefone com DDD ou deixe vazio para usar o contato do responsável.');
   if(s.caravans.some(c=>c.id!==arg.id&&c.members.some(x=>x.code===m.code)))throw Error('Um ingresso já pertence a outra caravana nesta data.');
   const p=s.people.find(p=>p.id===m.code);
   const before=old?.members.find(x=>x.code===m.code);
   if(p&&before&&native(m.code)&&(before.name!==m.name||phone(before.phone)!==m.phone))throw Error('Não altere a identificação de quem já entrou.');
   if(p?.group&&p.group!==group.id)throw Error('Um integrante já está em outro grupo. Corrija a alocação antes de cadastrar.');
   codes.add(m.code);
  }
  if(old?.members.some(m=>!codes.has(m.code)&&s.people.some(p=>p.id===m.code)))throw Error('Não remova integrantes que já passaram pela Portaria.');
  const others=s.caravans.filter(c=>c.id!==arg.id&&c.group===group.id).flatMap(c=>c.members.map(m=>m.code));
  const occupied=new Set([...others,...group.members,...codes]);
  if(occupied.size>25)throw Error('Este grupo já tem 25 vagas ocupadas ou reservadas. Escolha outro grupo de caravana.');
  const eta=String(arg.eta||'');if(eta&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(eta))throw Error('Horário previsto inválido.');
  const unchanged=old&&members.length===old.members.length&&members.every(m=>old.members.some(x=>x.code===m.code&&x.name===m.name));
  const c={id:arg.id,name:text(arg.name,'o nome da caravana'),city:text(arg.city,'a cidade'),responsible:text(arg.responsible,'o responsável'),contact:text(arg.contact,'o contato',80,true),eta,group:group.id,members,authorization:unchanged?old.authorization||null:null,authorizationHistory:old?.authorizationHistory||[],updatedAt:now};
  s.caravans=s.caravans.filter(c=>c.id!==arg.id);s.caravans.push(c);
  for(const p of s.people){const match=identity(s,p.id);if(match)p.caravan=match;}
  return c.name+' · '+c.city+': '+members.length+' integrante(s) reservado(s) em '+group.id+'. Cadastro não emite ingresso nem registra chegada.';
 }
 if(action==='caravanAuthorize'){
  const c=s.caravans.find(c=>c.id===arg.id);if(!c)throw Error('Caravana não localizada.');
  if(!['dinheiro','pix_igreja','cortesia','revogar'].includes(arg.method))throw Error('Informe recebimento ou cortesia autorizada.');
  if(!c.members.some(m=>native(m.code)))throw Error('Esta lista utiliza ingressos Even3.');
  c.authorization={status:arg.method==='revogar'?'revoked':'authorized',method:arg.method,reference:text(arg.reference,'a referência ou justificativa',200),by:arg.actorId,at:now};
  c.authorizationHistory??=[];c.authorizationHistory.push({...c.authorization,members:c.members.map(m=>({code:m.code,name:m.name}))});
  return c.name+(arg.method==='revogar'?' com autorização revogada para novas entradas.':' com entrada autorizada pelo Caixa/Gestão para '+c.members.length+' integrante(s).');
 }
 if(action==='caravanDelete'){
  const c=s.caravans.find(c=>c.id===arg.id);if(!c)throw Error('Caravana não localizada.');
  if(c.authorizationHistory?.length)throw Error('Preserve esta lista: há histórico de recebimento ou autorização. Revogue a autorização se necessário.');
  if(c.members.some(m=>s.people.some(p=>p.id===m.code)))throw Error('Esta caravana já tem chegadas. Preserve o cadastro e o histórico.');
  s.caravans=s.caravans.filter(x=>x.id!==c.id);return 'Cadastro de '+c.name+' removido antes das chegadas.';
 }
 if(action==='caravanTransfer'){
  const c=s.caravans.find(c=>c.members.some(m=>m.code===arg.code)),p=s.people.find(p=>p.id===arg.code);
  const to=s.groups.find(g=>g.id===arg.group);
  if(!c||p?.group)throw Error('Remaneje apenas integrantes ainda sem grupo atribuído.');
  if(!to||to.id===c.group||!reserved(s,day,to.id)||to.status!=='forming')throw Error('Escolha outro grupo de caravana em formação.');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(arg.id||''))||s.caravans.some(x=>x.id===arg.id))throw Error('Identificador de remanejamento inválido.');
  const occupied=new Set([...to.members,...s.caravans.filter(x=>x.group===to.id).flatMap(x=>x.members.map(m=>m.code))]);
  if(occupied.size>=25)throw Error('Grupo de destino sem vagas reserváveis.');
  const reason=text(arg.reason,'o motivo',300),m=c.members.find(m=>m.code===arg.code);
  c.members=c.members.filter(m=>m.code!==arg.code);
  s.caravans=s.caravans.filter(x=>x.members.length);
  s.caravans.push({...c,id:arg.id,group:to.id,members:[m],updatedAt:now});
  if(p)p.caravan=identity(s,p.id);
  return m.name+': reserva de '+c.group+' remanejada para '+to.id+'. Motivo: '+reason;
 }
 const g=s.groups.find(g=>g.id===arg.group);
 if(!g||!GROUPS.includes(g.id)||!['forming','closed'].includes(g.status))throw Error('Escolha um grupo de caravana ainda no salão.');
 const reason=text(arg.reason,'o motivo',300);
 if(action==='caravanDefer'){
  if(!reserved(s,day,g.id))throw Error('Este grupo foi liberado para público geral.');
  g.caravanDeferred=!g.caravanDeferred;
  return g.id+(g.caravanDeferred?' com chamada adiada; os demais grupos podem seguir.':' com prioridade de chamada retomada.')+' Motivo: '+reason;
 }
 if(action==='caravanRelease'){
  if(g.members.length||s.caravans.some(c=>c.group===g.id))throw Error('Só libere uma reserva vazia e sem integrantes cadastrados.');
  s.caravanReleased??=[];
  if(s.caravanReleased.includes(g.id)){s.caravanReleased=s.caravanReleased.filter(id=>id!==g.id);return g.id+' reservado novamente para caravanas. Motivo: '+reason;}
  s.caravanReleased.push(g.id);g.caravanDeferred=false;return g.id+' liberado para público geral. Motivo: '+reason;
 }
 throw Error('Comando de caravana inválido.');
}
function gateRows(s,day,now=new Date().toISOString()){
 return list(s).flatMap(c=>c.members.filter(m=>native(m.code)).map(m=>{
  const p=s.people.find(p=>p.id===m.code);
  return {code:m.code,name:m.name,phone:m.phone||'',contact:c.contact||'',responsible:c.responsible,caravanId:c.id,caravanName:c.name,city:c.city,date:day,group:c.group,authorized:c.authorization?.status==='authorized',admitted:!!p,arrivedAt:p?.arrivedAt||null,eligible:!p&&day===bahiaDay(now)&&c.authorization?.status==='authorized'};
 }));
}
module.exports={DAYS,GROUPS,enabled,reserved,list,identity,compatible,handle,native,bahiaDay,gateRows};
