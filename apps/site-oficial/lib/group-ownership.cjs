'use strict';
const COORD=new Set(['assign','deliver','undoDelivery','move','close','reopen','call']);
const GUIDE=new Set(['arrive','start','safe','finish']);
function affected(action,arg={},sessionState){
 if(!COORD.has(action)&&!GUIDE.has(action))return [];
 if(action==='move'){
  const person=sessionState.people.find(p=>p.id===arg.id);
  return [...new Set([person?.group,arg.group].filter(Boolean))];
 }
 if(action==='assign'||['close','reopen','call','arrive','start','safe','finish'].includes(action))return arg.group?[arg.group]:[];
 if(['deliver','undoDelivery'].includes(action)){
  const ids=[...new Set(arg.ids||[])];
  return [...new Set(ids.map(id=>sessionState.people.find(p=>p.id===id)?.group).filter(Boolean))];
 }
 return [];
}
function slot(action){if(COORD.has(action))return 'coordinator_id';if(GUIDE.has(action))return 'guide_id';return null;}
function permitted(role,userId,action,groups,owners){
 if(role==='geral')return true;
 const col=slot(action);
 if(!col)return true;
 for(const id of groups){
  const owner=owners[id]?.[col];
  if(!owner||owner!==userId)return false;
 }
 return true;
}
module.exports={COORD,GUIDE,affected,slot,permitted};
