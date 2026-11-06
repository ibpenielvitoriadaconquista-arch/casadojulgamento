'use strict';
function allowed(role,method,body={}){
 if(role==='geral')return true;
 if(role==='coordenacao')return method==='POST'&&body.action==='authorize_date'&&body.confirmed===true;
 return role==='caixa'&&method==='POST'&&body.action==='authorize'&&body.paymentStatus==='paid'&&body.received===true&&['dinheiro','pix_igreja'].includes(body.paymentMethod);
}
module.exports={allowed};
