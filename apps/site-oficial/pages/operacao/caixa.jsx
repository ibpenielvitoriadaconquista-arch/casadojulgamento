import StaffShell from '../../components/StaffShell';
import {actor} from '../../lib/operation-auth';
export async function getServerSideProps({req,res}){
 res.setHeader('Cache-Control','private, no-store');
 try{
  const user=await actor(req);
  if(user.role!=='geral'&&user.role!=='caixa')return {redirect:{destination:'/operacao/'+user.role,permanent:false}};
  return {props:{}};
 }catch{return {redirect:{destination:'/operacao/login',permanent:false}};}
}
export default function Caixa(){
 return <StaffShell title="Caixa · Casa do Julgamento">
  <p>Seu acesso ao posto está ativo. O lançamento de pagamentos presenciais estará disponível após a homologação da emissão e conferência dos ingressos oficiais Even3.</p>
  <p><strong>Não registre recebimentos por esta tela ainda.</strong> Solicite à Gestão Geral o procedimento provisório de conferência.</p>
  <a href="/operacao/login">Voltar ao acesso da equipe</a>
 </StaffShell>;
}
