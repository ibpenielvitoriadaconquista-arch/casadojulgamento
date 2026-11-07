'use strict';
const TITLES={payment:'Conferência financeira individual',external_confirmed:'Even3 já credenciou: recuperar encaminhamento',external_retry:'Even3 NÃO credenciou: permitir nova tentativa'};
function commandFor(p,payment='PAGO',evidence='referência da conferência'){
 return p.kind==='payment'?`PAGAMENTO ${p.code} ${payment} ${evidence}`:p.kind==='external_confirmed'?`RECUPERAR ${p.code} CREDENCIADO ${evidence}`:p.kind==='external_retry'?`RECUPERAR ${p.code} NAO_CREDENCIADO ${evidence}`:`LIBERAR ${p.code} ${payment} ${evidence}`;
}
module.exports={TITLES,commandFor};
