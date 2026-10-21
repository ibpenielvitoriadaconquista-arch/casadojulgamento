import OperationTraining from '../../../components/OperationTraining';
import RehearsalPanel from '../../../components/RehearsalPanel';
import {actor} from '../../../lib/operation-auth';
import ops from '../../../lib/operation-training.cjs';
export async function getServerSideProps({req,res,params}){
 res.setHeader('Cache-Control','private, no-store');
 if(!Object.hasOwn(ops.ROLES,params.posto)||params.posto==='caixa'||params.posto==='telao')return {notFound:true};
 try{
  const user=await actor(req);
  if(user.role!=='geral'&&user.role!==params.posto)return {redirect:{destination:'/operacao/'+user.role,permanent:false}};
  return {props:{role:params.posto,viewerRole:user.role}};
 }catch{return {redirect:{destination:'/operacao/login',permanent:false}};}
}
export default function EnsaioPosto({role,viewerRole}){
 return role==='apoio'?<RehearsalPanel remote={false}/>:<OperationTraining role={role} viewerRole={viewerRole} remote rehearsal/>;
}
