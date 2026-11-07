'use strict';
// Request alerts belong to Gestão Geral; caravan registration and arrival permissions are separate.
const canReceive=role=>role==='geral';
const showOnPanel=(viewerRole,panelRole)=>canReceive(viewerRole)&&panelRole==='geral';
module.exports={canReceive,showOnPanel};
