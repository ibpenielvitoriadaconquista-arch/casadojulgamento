'use strict';
function snapshot(value){
 if(!value||!Number.isSafeInteger(value.revision)||!Array.isArray(value.members))throw Error('Resposta de caravanas incompleta. Confira a conexão.');
 return {...value,pendingLists:value.pendingLists||[]};
}
async function read({session,fetcher=fetch}){
 const response=await fetcher('/api/operacao/caravanas?session='+encodeURIComponent(session),{cache:'no-store',signal:AbortSignal.timeout(10000)});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível conferir as chegadas.');return snapshot(data);
}
// Never resend a POST automatically. An uncertain result is reconciled by reading.
async function send({command,fetcher=fetch}){
 let failure,serverMessage;
 try{
  const response=await fetcher('/api/operacao',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(12000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'O registro não foi confirmado.');serverMessage=result.message;
  if(result.caravanGate){
   const data=snapshot(result.caravanGate),member=data.members.find(m=>m.code===command.arg.code);
   if(!member?.admitted)throw Error('O servidor não confirmou a entrada desta pessoa.');
   return {confirmed:true,online:true,data,message:serverMessage};
  }
 }catch(e){failure=e;}
 try{
  const data=await read({session:command.session,fetcher}),member=data.members.find(m=>m.code===command.arg.code);
  if(member?.admitted)return {confirmed:true,online:true,data,reconciled:true,message:serverMessage||member.name+': entrada confirmada no sistema. Encaminhar à Coordenação.'};
  return {confirmed:false,online:true,data,error:failure?.message||'Entrada ainda não confirmada. Confira a lista antes de tentar novamente.'};
 }catch{
  return {confirmed:false,online:false,uncertain:true,error:'Sem confirmação da entrada. Aguarde a reconexão e confira a lista antes de tentar novamente.'};
 }
}
module.exports={read,send};
