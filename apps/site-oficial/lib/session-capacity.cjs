'use strict';
const capacities=Object.freeze({
 '2026-11-11':[6,35,200],
 '2026-10-22':[15,20,300],
 '2026-11-09':[25,25,550],
 '2026-11-13':[20,35,500],
 '2026-11-14':[30,35,750],
 '2026-11-19':[20,35,500],
 '2026-11-20':[30,35,750],
 '2026-11-21':[30,35,750]
});
function capacityFor(session){
 const value=capacities[session];
 if(!value)throw Error('Sessão inválida.');
 const [groups,groupSize,total]=value;
 return {groups,groupSize,total};
}
module.exports={capacityFor};
