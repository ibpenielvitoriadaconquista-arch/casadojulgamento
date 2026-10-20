'use strict';
const ROLES=Object.freeze({guia:'guias',guias:'guias',coordenacao:'coordenacao',caixa:'caixa',apoio:'apoio',portaria:'portaria'});
function cleanInput(payload){
 const name=String(payload?.name||'').trim().replace(/\s+/g,' ');
 const email=String(payload?.email||'').trim().toLowerCase();
 const whatsapp=String(payload?.whatsapp||'').replace(/[\s()\-]/g,'');
 const role=ROLES[payload?.role];
 if(name.length<2||name.length>120||/[<>\x00-\x1f]/.test(name))throw Error('Informe nome completo válido.');
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Informe um e-mail válido.');
 if(!/^\+?[0-9]{10,15}$/.test(whatsapp))throw Error('Informe um WhatsApp com DDD (10 a 15 dígitos).');
 if(!role)throw Error('Escolha uma função.');
 return {name,email,whatsapp,role};
}
module.exports={ROLES,cleanInput};
