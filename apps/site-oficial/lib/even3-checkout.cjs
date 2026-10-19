'use strict';
// Checkout por entrada da Even3. IDs oficiais fornecidos pelo organizador em 19/10/2026;
// exigem confirmação comercial na conta Even3 antes de ativação em produção.
// ATENÇÃO: idIngresso (tipo de entrada) não é data.inscricao.id nem inscricao.codigo.
const EVENT_SLUG='casa-do-julgamento-2026-798621';
const EVENT_ID='798621';
const ENTRIES=Object.freeze([
  {
    "dia": "09-11",
    "date": "09/11/2026",
    "iso": "2026-11-09",
    "time": "17h",
    "ticket": "968577"
  },
  {
    "dia": "13-11",
    "date": "13/11/2026",
    "iso": "2026-11-13",
    "time": "20h",
    "ticket": "968578"
  },
  {
    "dia": "14-11",
    "date": "14/11/2026",
    "iso": "2026-11-14",
    "time": "18h",
    "ticket": "968579"
  },
  {
    "dia": "19-11",
    "date": "19/11/2026",
    "iso": "2026-11-19",
    "time": "20h",
    "ticket": "968580"
  },
  {
    "dia": "20-11",
    "date": "20/11/2026",
    "iso": "2026-11-20",
    "time": "17h",
    "ticket": "968581"
  },
  {
    "dia": "21-11",
    "date": "21/11/2026",
    "iso": "2026-11-21",
    "time": "18h",
    "ticket": "968582"
  }
].map(s=>Object.freeze(s)));
function buildCheckoutUrl(ticket){
  const id=String(ticket??'');
  if(!/^[1-9][0-9]{1,18}$/.test(id))throw new Error('ID da entrada Even3 inválido');
  const url=new URL('https://www.even3.com.br/auxcheckout/redirect');
  url.searchParams.set('urlEvento',EVENT_SLUG);
  url.searchParams.set('idIngresso',id);
  url.searchParams.set('lang','pt');
  return url.toString();
}
function byDay(dia){return ENTRIES.find(s=>s.dia===dia)||null;}
module.exports={ENTRIES,EVENT_ID,EVENT_SLUG,buildCheckoutUrl,byDay};
