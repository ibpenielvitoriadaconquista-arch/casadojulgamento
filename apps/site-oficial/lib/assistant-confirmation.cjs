"use strict";
const fail=(status,message)=>Object.assign(new Error(message),{status});
function parse(message){
 const m=String(message).trim().match(/^LIBERAR\s+(\d{6,20})\s+(PAGO|CORTESIA)\s+([\s\S]+)$/i);
 if(!m)return null;const evidence=m[3].trim();
 if(evidence.length<10||evidence.length>500)throw fail(400,'Descreva a conferência com 10–500 caracteres após PAGO ou CORTESIA.');
 return {code:m[1],paymentStatus:m[2].toUpperCase()==='PAGO'?'paid':'exempt',evidence};
}
async function findProposal({query,user,threadId,session,command}){
 const rows=(await query("SELECT id FROM peniel_ops.assistant_proposals WHERE owner_id=$1 AND thread_id=$2 AND status='pending' AND expires_at>now() AND payload->>'code'=$3 AND payload->>'target'=$4 LIMIT 2",[user.user_id,threadId,command.code,session])).rows;
 if(rows.length!==1)throw fail(409,rows.length?'Há mais de uma ficha para este código. Use a confirmação da ficha exata abaixo.':'Não há ficha válida para este código nesta conversa e sessão. Peça ao agente para consultar e preparar a liberação primeiro.');
 return rows[0].id;
}
async function confirm({query,user,proposalId,paymentStatus,evidence,token,fetcher=fetch}){
 if(user?.role!=='geral'||!user.user_id)throw fail(403,'Somente Gestão Geral.');
 if(!['paid','exempt'].includes(paymentStatus)||typeof evidence!=='string'||evidence.trim().length<10||evidence.length>500)throw fail(400,'Informe pagamento ou cortesia e a evidência conferida.');
 const proposal=(await query("UPDATE peniel_ops.assistant_proposals SET status='processing',used_at=now() WHERE id=$1 AND owner_id=$2 AND status='pending' AND expires_at>now() RETURNING payload",[proposalId,user.user_id])).rows[0]?.payload;
 if(!proposal)throw fail(409,'Ficha expirada ou já utilizada. Consulte novamente antes de preparar outra.');
 let status='uncertain',result;
 try{
  const r=await fetcher('https://www.ibpeniel.com/api/operacao/autorizacoes',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://www.ibpeniel.com',Cookie:'peniel_session='+encodeURIComponent(token)},body:JSON.stringify({action:'authorize_date',code:proposal.code,session:proposal.target,paymentStatus,evidence:evidence.trim(),confirmed:true}),redirect:'error',signal:AbortSignal.timeout(45000)});
  result=await r.json();status=r.ok?'authorized':r.status<500?'rejected':'uncertain';
 }catch{result={error:'Resposta incerta. Confira a autorização no painel antes de tentar novamente.'};}
 await query('UPDATE peniel_ops.assistant_proposals SET status=$2 WHERE id=$1',[proposalId,status]);
 return {status,message:status==='authorized'?'Exceção autorizada com auditoria. A Portaria ainda precisa concluir a entrada.':result.error||'Resposta incerta; confira o painel antes de tentar novamente.'};
}
module.exports={parse,findProposal,confirm};
