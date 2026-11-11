import CashierPanel from '../../components/CashierPanel';
import OperationTraining from '../../components/OperationTraining';
import {actor} from '../../lib/operation-auth';
import ops from '../../lib/operation-training.cjs';
export async function getServerSideProps({req,res,params,query={}}){
 res.setHeader('Cache-Control','private, no-store');
 if(!Object.hasOwn(ops.ROLES,params.posto))return {notFound:true};
 let viewerRole;
 try{const user=await actor(req,res);viewerRole=user.role;if(user.role!=='geral'&&user.role!==params.posto)return {redirect:{destination:'/operacao/'+user.role,permanent:false}};}
 catch{return {redirect:{destination:'/operacao/login',permanent:false}};}
 return {props:{role:params.posto,viewerRole,displayOnly:params.posto==='telao'&&query.exibir==='1'}};
}
export default function Posto({role,viewerRole,displayOnly}){return role==='caixa'?<CashierPanel/>:<OperationTraining role={role} viewerRole={viewerRole} displayOnly={displayOnly} remote/>;}
