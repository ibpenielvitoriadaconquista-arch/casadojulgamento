import CashierPanel from '../../components/CashierPanel';
import {actor} from '../../lib/operation-auth';
export async function getServerSideProps({req,res}){
 res.setHeader('Cache-Control','private, no-store');
 try{
  const user=await actor(req);
  if(user.role!=='geral'&&user.role!=='caixa')return {redirect:{destination:'/operacao/'+user.role,permanent:false}};
  return {props:{}};
 }catch{return {redirect:{destination:'/operacao/login',permanent:false}};}
}
export default function Caixa(){return <CashierPanel/>;}
