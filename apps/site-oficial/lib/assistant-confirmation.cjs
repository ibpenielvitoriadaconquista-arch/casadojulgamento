"use strict";
const fail=(status,message)=>Object.assign(new Error(message),{status});
function parse(message){
 const text=String(message).trim();
 const financial=text.match(/^(LIBERAR|PAGAMENTO)\s+(\d{6,20})\s+(PAGO|CORTESIA)\s+([\s\S]+)$/i);
 const recovery=text.match(/^RECUPERAR\s+(\d{6,20})\s+(CREDENCIADO|NAO_CREDENCIADO)\s+([\s\S]+)$/i);
 if(!financial&&!recovery)return null;
 const evidence=(financial?financial[4]:recovery[3]).trim();
 if(evidence.length<10||evidence.length>500)throw fail(400,'Descreva a conferência com 10–500 caracteres após a ação.');
 return financial?{code:financial[2],paymentStatus:financial[3].toUpperCase()==='PAGO'?'paid':'exempt',evidence,...(financial[1].toUpperCase()==='PAGAMENTO'?{kind:'payment'}:{})}:{code:recovery[1],paymentStatus:'paid',evidence,kind:recovery[2].toUpperCase()==='CREDENCIADO'?'external_confirmed':'external_retry'};
}
async function findProposal({query,user,threadId,session,command}){
 const rows=(await query("SELECT id FROM peniel_ops.assistant_proposals WHERE owner_id=$1 AND thread_id=$2 AND status='pending' AND expires_at>now() AND payload->>'code'=$3 AND payload->>'target'=$4 AND COALESCE(payload->>'kind','date')=$5 LIMIT 2",[user.user_id,threadId,command.code,session,command.kind||'date'])).rows;
 if(rows.length!==1)throw fail(409,rows.length?'Há mais de uma ficha para este código. Use a confirmação da ficha exata abaixo.':'Não há ficha válida para este código nesta conversa e sessão. Peça ao agente para consultar e preparar a liberação primeiro.');
 return rows[0].id;
}
async function confirm({query,user,proposalId,paymentStatus,evidence,token,fetcher=fetch}){
 if(user?.role!=='geral'||!user.user_id)throw fail(403,'Somente Gestão Geral.');
 if(!['paid','exempt'].includes(paymentStatus)||typeof evidence!=='string'||evidence.trim().length<10||evidence.length>500)throw fail(400,'Informe pagamento ou cortesia e a evidência conferida.');
 const proposal=(await query("UPDATE peniel_ops.assistant_proposals SET status='processing',used_at=now() WHERE id=$1 AND owner_id=$2 AND status='pending' AND expires_at>now() RETURNING payload",[proposalId,user.user_id])).rows[0]?.payload;
 if(!proposal)throw fail(409,'Ficha expirada ou já utilizada. Consulte novamente antes de preparar outra.');
 const kind=proposal.kind||'date',action={date:'authorize_date',payment:'authorize',external_confirmed:'confirm_external',external_retry:'retry_external'}[kind];
 if(!action){await query("UPDATE peniel_ops.assistant_proposals SET status='rejected' WHERE id=$1",[proposalId]);throw fail(409,'Tipo de ficha inválido.');}
 let status='uncertain',result;
 try{
  const r=await fetcher('https://www.ibpeniel.com/api/operacao/autorizacoes',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://www.ibpeniel.com',Cookie:'peniel_session='+encodeURIComponent(token)},body:JSON.stringify({action,code:proposal.code,session:proposal.target,paymentStatus,evidence:evidence.trim(),confirmed:true,assistantReview:true,expectedAttemptRequestedAt:proposal.expectedAttemptRequestedAt||null}),redirect:'error',signal:AbortSignal.timeout(45000)});
  result=await r.json();status=r.ok&&result?.ok===true?'authorized':!r.ok&&r.status<500?'rejected':'uncertain';
 }catch{result={error:'Resposta incerta. Confira a autorização no painel antes de tentar novamente.'};}
 await query('UPDATE peniel_ops.assistant_proposals SET status=$2 WHERE id=$1',[proposalId,status]);
 return {status,kind,message:status==='authorized'?kind==='date'?'Exceção autorizada com auditoria. A Portaria ainda precisa concluir a entrada.':kind==='payment'?'Conferência financeira registrada com auditoria. Isso não altera a data nem registra a entrada.':kind==='external_confirmed'?'Conferência manual de credenciamento registrada. A Portaria pode concluir o encaminhamento sem reenviar.':'Nova tentativa habilitada após conferência do gestor de que NÃO houve credenciamento. Nenhum envio foi feito; a Portaria deve consultar e tentar novamente.':result.error||'Resposta incerta; confira o painel antes de tentar novamente.'};
}
module.exports={parse,findProposal,confirm};
