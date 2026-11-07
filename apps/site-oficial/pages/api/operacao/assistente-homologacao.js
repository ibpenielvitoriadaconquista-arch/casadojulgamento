import {actor,fail,sameOrigin} from '../../../lib/operation-auth';
import {throttle} from '../../../lib/staff-access';
import assistant from '../../../lib/operations-assistant.cjs';
import homologation from '../../../lib/assistant-homologation.cjs';
import manual from '../../../lib/assistant-manual.json';
export const config={api:{bodyParser:{sizeLimit:'1kb'}},maxDuration:180};
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 try{
  const user=await actor(req);assistant.requireManager(user);
  if(req.method!=='POST')throw fail(405,'Método não permitido.');sameOrigin(req);await throttle(req,'assistant_homologation',user.user_id);
  const report={at:new Date().toISOString(),manualVersion:manual.version,scope:'Lote 1 simulado em memória. Zero escrita no banco operacional e zero requisição real à Even3.',technical:await homologation.run()};
  if(req.body?.withAI===true){
   try{report.ai=await homologation.runWithAI({apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL});}catch(e){report.ai={ok:false,status:'blocked',error:e.status?e.message:'Não foi possível concluir o teste com a OpenAI. Use as consultas rápidas.'};}
  }else report.ai={status:'not_run',note:'Teste com OpenAI real ainda não executado nesta verificação.'};
  report.operationalAdmission='Credenciamento real Even3 e recuperação em aparelhos reais devem ser validados separadamente; esta simulação não prova esses resultados.';
  return res.json(report);
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Não foi possível executar a homologação isolada.'});}
}
