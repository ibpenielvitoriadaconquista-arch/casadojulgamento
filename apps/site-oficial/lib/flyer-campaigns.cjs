const campaigns={lote01:{utm_source:"panfleto",utm_medium:"impresso",utm_campaign:"casa_julgamento_2026",utm_content:"lote01"}};
function destinationFor(code){if(typeof code!=="string"||!/^[a-z0-9-]{1,32}$/.test(code)||!Object.prototype.hasOwnProperty.call(campaigns,code))return null;return "/convite?"+new URLSearchParams(campaigns[code]).toString();}
module.exports={destinationFor};