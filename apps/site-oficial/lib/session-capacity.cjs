'use strict';
const capacities=Object.freeze({
 '2026-10-22':[15,20],
 '2026-11-09':[25,25],
 '2026-11-13':[20,25],
 '2026-11-14':[30,25],
 '2026-11-19':[20,25],
 '2026-11-20':[30,25],
 '2026-11-21':[30,25]
});
function capacityFor(session){
 const value=capacities[session];
 if(!value)throw Error('Sessão inválida.');
 const [groups,groupSize]=value;
 return {groups,groupSize,total:groups*groupSize};
}
module.exports={capacityFor};
