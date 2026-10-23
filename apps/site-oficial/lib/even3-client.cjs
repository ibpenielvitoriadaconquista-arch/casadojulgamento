'use strict';
const BASE='https://www.even3.com.br/api/v1/';
function items(x){return Array.isArray(x)?x:Array.isArray(x?.data)?x.data:[];}
function error(message){const e=new Error(message);e.status=503;return e;}
async function request(path,{method='GET',body,token=process.env.EVEN3_API_TOKEN,fetcher=fetch}={}){
 if(!token)throw error('Credencial Even3 não configurada.');
 const r=await fetcher(BASE+path,{method,headers:{'Authorization-Token':token,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(10000)});
 const text=await r.text();
 if(!r.ok)throw error('Even3 indisponível (HTTP '+r.status+').');
 if(text.length>5000000)throw error('Resposta Even3 excedeu o limite de conferência.');
 try{return JSON.parse(text);}catch{throw error('Resposta Even3 inválida.');}
}
async function event(){const x=await request('event');const e=items(x).find(e=>String(e.id_event)==='798621')||(String(x?.id_event)==='798621'?x:null);if(!e)throw error('A chave Even3 não corresponde ao evento.');return e;}
async function attendee(id){const x=items(await request('attendees/'+encodeURIComponent(id)));if(x.length!==1)throw error('Participante não localizado de forma única na Even3.');return x[0];}
async function checkin(code,at){
 // Caller persists the sending reservation before this request. Any failure is ambiguous.
 const result=await request('checkin/attendees',{method:'POST',body:{attendees:[{checkin_code:String(code),checkin:1,checkin_date:at}]}});
 if(result!=='OK')throw error('Resposta de credenciamento não confirmada. A Gestão deve conferir a Even3 antes de repetir.');
 return 'OK';
}
module.exports={items,request,event,attendee,checkin};
