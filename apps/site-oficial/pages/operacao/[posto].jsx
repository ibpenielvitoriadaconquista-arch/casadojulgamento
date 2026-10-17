import OperationTraining from '../../components/OperationTraining';
import {actor} from '../../lib/operation-auth';
import ops from '../../lib/operation-training.cjs';
export async function getServerSideProps({req,res,params}){
 res.setHeader('Cache-Control','private, no-store');
 if(!Object.hasOwn(ops.ROLES,params.posto))return {notFound:true};
 try{const user=await actor(req);if(user.role!=='geral'&&user.role!==params.posto)return {redirect:{destination:'/operacao/'+user.role,permanent:false}};}
 catch{return {redirect:{destination:'/operacao/login',permanent:false}};}
 return {props:{role:params.posto}};
}
export default function Posto({role}){return <OperationTraining role={role} remote/>;}
