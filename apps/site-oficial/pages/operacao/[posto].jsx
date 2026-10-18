import RehearsalPanel from '../../components/RehearsalPanel';
import OperationTraining from '../../components/OperationTraining';
import {actor} from '../../lib/operation-auth';
import ops from '../../lib/operation-training.cjs';
export async function getServerSideProps({req,res,params}){
 res.setHeader('Cache-Control','private, no-store');
 if(!Object.hasOwn(ops.ROLES,params.posto))return {notFound:true};
 let viewerRole;
 try{const user=await actor(req);viewerRole=user.role;if(user.role!=='geral'&&user.role!==params.posto&&!(params.posto==='apoio'&&['guias','coordenacao'].includes(user.role)))return {redirect:{destination:'/operacao/'+user.role,permanent:false}};}
 catch{return {redirect:{destination:'/operacao/login',permanent:false}};}
 return {props:{role:params.posto,viewerRole}};
}
export default function Posto({role,viewerRole}){return role==='apoio'?<RehearsalPanel remote/>:<OperationTraining role={role} viewerRole={viewerRole} remote/>;}
