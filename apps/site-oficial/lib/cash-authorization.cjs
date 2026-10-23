'use strict';
function allowed(role,method,body={}){
 if(role==='geral')return true;
 return role==='caixa'&&method==='POST'&&body.action==='authorize'&&body.paymentStatus==='paid'&&body.received===true&&['dinheiro','pix_igreja'].includes(body.paymentMethod);
}
module.exports={allowed};
