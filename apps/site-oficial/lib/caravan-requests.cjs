'use strict';
const caravans=require('./caravans.cjs');
function clean(value,label,max,required=true){const x=String(value||'').trim();if((required&&x.length<2)||x.length>max||/[<>\x00-\x1f]/.test(x))throw Error('Confira '+label+'.');return x;}
function input(body){
 const day=String(body?.session||'');if(!caravans.enabled(day))throw Error('Escolha uma data da apresentação.');
 const name=clean(body.name,'o nome da caravana',100),city=clean(body.city,'a cidade',100),responsible=clean(body.responsible,'o nome do responsável',100);
 const contact=String(body.contact||'').replace(/\D/g,'');if(contact.length<10||contact.length>15)throw Error('Informe o telefone do responsável com DDD.');
 if(!Array.isArray(body.members)||!body.members.length||body.members.length>25)throw Error('Informe de 1 a 25 integrantes. Para grupos maiores, envie listas separadas.');
 const members=body.members.map(m=>{const phone=String(m?.phone||'').replace(/\D/g,'');if(phone&&(phone.length<10||phone.length>15))throw Error('Confira o telefone do integrante com DDD.');return {name:clean(m?.name,'o nome de cada integrante',150),phone};});
 const eta=String(body.eta||'');if(eta&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(eta))throw Error('Confira o horário de chegada.');
 return {session:day,name,city,responsible,contact,eta,members};
}
module.exports={input};
