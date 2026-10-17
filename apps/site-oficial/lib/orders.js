import crypto from "node:crypto";
import { query, transaction } from "./db";
import rules from "./rules.cjs";
import security from "./security.cjs";
const { ONLINE_CAPACITY, validateOrder, RESERVATION_MINUTES } = rules;
const { randomToken, tokenHash, secureEqual, encryptTicketToken, decryptTicketToken } = security;

// A linha da sessão é o mutex transacional para reserva/confirmacao/expiração.
// Não faça operações longas externas (rede PIX, WhatsApp) dentro da transação.
async function lockSession(client, sessionId) {
  const r=await client.query("SELECT * FROM sessoes WHERE id=$1 AND ativa=true FOR UPDATE",[sessionId]);
  if(!r.rows.length) throw Object.assign(new Error("Sessão indisponível"),{statusCode:400});
  return r.rows[0];
}
async function activeCount(client, sessionId){
  const r=await client.query(`SELECT COALESCE(SUM(quantidade),0)::int AS used FROM pedidos
    WHERE sessao_id=$1 AND (status='pago' OR (status IN ('reservado','aguardando_pix') AND expira_em>now()))`,[sessionId]);
  return r.rows[0].used;
}
async function expireDueForSession(client,sessionId){
  await client.query(`UPDATE pedidos SET status='expirado'
    WHERE sessao_id=$1 AND status IN ('reservado','aguardando_pix') AND expira_em<=now()`,[sessionId]);
}
export async function listSessions(){
  const r=await query(`SELECT s.id,s.portoes,s.online_cap,s.ativa,
  COALESCE(SUM(p.quantidade) FILTER (WHERE p.status='pago' OR
    (p.status IN ('reservado','aguardando_pix') AND p.expira_em>now())),0)::int AS ocupadas
  FROM sessoes s LEFT JOIN pedidos p ON p.sessao_id=s.id
  GROUP BY s.id ORDER BY s.id`);
  const allowed=new Set(rules.SESSIONS.map(x=>x.id));
  return r.rows.filter(s=>allowed.has(s.id)&&s.ativa).map(s=>({
    id:s.id, portoes:s.portoes,
    vagasOnlineRestantes:Math.max(0,s.online_cap-s.ocupadas)
  }));
}
export async function createOrder(input){
  const v=validateOrder(input);
  const id=crypto.randomUUID(), secret=randomToken();
  await transaction(async client=>{
    const session=await lockSession(client,v.sessaoId);
    await expireDueForSession(client,v.sessaoId);
    const used=await activeCount(client,v.sessaoId);
    if(used+v.quantidade>session.online_cap || used+v.quantidade>ONLINE_CAPACITY)
      throw Object.assign(new Error("Não há vagas suficientes"),{statusCode:409});
    await client.query(`INSERT INTO pedidos
      (id,sessao_id,nome,whatsapp,quantidade,valor_centavos,alimentos_kg,access_hash,expira_em)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+($9*interval '1 minute'))`,
      [id,v.sessaoId,v.nome,v.whatsapp,v.quantidade,v.valorCentavos,v.alimentosKg,tokenHash(secret),RESERVATION_MINUTES]);
  });
  return {id, secret, expiraEmMinutos:RESERVATION_MINUTES};
}
export async function ownerOrder(id,secret){
  if(!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  if(!secret || secret.length>100) return null;
  const r=await query(`SELECT id,sessao_id,nome,quantidade,valor_centavos,alimentos_kg,status,expira_em,access_hash
    FROM pedidos WHERE id=$1`,[id]);
  const o=r.rows[0];
  if(!o || !secureEqual(o.access_hash,tokenHash(secret))) return null;
  // Se não houve confirmação e expirou, nunca exibir como válida.
  const status=(['reservado','aguardando_pix'].includes(o.status) && new Date(o.expira_em).getTime()<=Date.now())?'expirado':o.status;
  return {id:o.id,sessaoId:o.sessao_id,quantidade:o.quantidade,valorCentavos:o.valor_centavos,alimentosKg:o.alimentos_kg,status,expiraEm:o.expira_em};
}
// Esta função NÃO recebe dados diretamente de uma requisição pública.
// Apenas o futuro adaptador PIX de gateway verificado pode invocá-la.
export async function finalizeVerifiedPayment({gateway,externalId,eventId,orderId,amountCents,currency,status}){
  if(!gateway || !externalId || !eventId || !orderId || !Number.isSafeInteger(amountCents) ||
     currency!=="BRL" || status!=="approved") throw new Error("Evento financeiro não verificado");
  return transaction(async client=>{
    const preliminary=await client.query("SELECT sessao_id FROM pedidos WHERE id=$1",[orderId]);
    if(!preliminary.rows.length) throw new Error("Pedido não encontrado");
    await lockSession(client,preliminary.rows[0].sessao_id);
    const res=await client.query("SELECT * FROM pedidos WHERE id=$1 FOR UPDATE",[orderId]);
    const order=res.rows[0];
    const exists=await client.query("SELECT 1 FROM pagamento_eventos WHERE gateway=$1 AND evento_id=$2",[gateway,eventId]);
    if(exists.rows.length) return {result:"duplicate"};
    await client.query("INSERT INTO pagamento_eventos(gateway,evento_id,pedido_id) VALUES($1,$2,$3)",[gateway,eventId,orderId]);
    if(amountCents!==order.valor_centavos){return {result:"amount_mismatch"};}
    if(order.status==='pago') return {result:"already_paid"};
    if(!['reservado','aguardando_pix'].includes(order.status)||new Date(order.expira_em).getTime()<=Date.now()){
      await client.query("UPDATE pedidos SET status='pagamento_tardio',gateway_ref=$2 WHERE id=$1",[orderId,externalId]);
      return {result:"late_payment_manual_refund"};
    }
    await client.query("UPDATE pedidos SET status='pago',pago_em=now(),gateway_ref=$2 WHERE id=$1",[orderId,externalId]);
    for(let i=0;i<order.quantidade;i++){
      const raw=randomToken();
      await client.query("INSERT INTO ingressos(id,pedido_id,token_hash,token_cipher) VALUES($1,$2,$3,$4)",
        [crypto.randomUUID(),orderId,tokenHash(raw),encryptTicketToken(raw,process.env.TICKET_ENCRYPTION_KEY_HEX)]);
    }
    return {result:"paid",ticketsIssued:order.quantidade};
  });
}
export async function ownerTickets(id,secret){
  const order=await ownerOrder(id,secret);
  if(!order || order.status!=="pago") return null;
  const res=await query("SELECT id,token_cipher,usado_em FROM ingressos WHERE pedido_id=$1 ORDER BY criado_em,id",[id]);
  return {order,tickets:res.rows.map(t=>({id:t.id,token:decryptTicketToken(t.token_cipher,process.env.TICKET_ENCRYPTION_KEY_HEX),usado:!!t.usado_em}))};
}
// Destinado EXCLUSIVAMENTE a route com identidade de operador verificada e autorização 'checkin'.
export async function checkInWithVerifiedStaff(ticketToken,operatorId){
  const tHash=tokenHash(ticketToken);
  if(!operatorId) throw new Error("Operador obrigatório");
  return transaction(async client=>{
    const r=await client.query(`UPDATE ingressos SET usado_em=now()
      WHERE token_hash=$1 AND usado_em IS NULL
      AND EXISTS(SELECT 1 FROM pedidos p WHERE p.id=ingressos.pedido_id AND p.status='pago')
      RETURNING id,pedido_id,usado_em`,[tHash]);
    if(!r.rows.length) return {result:"invalid_or_used"};
    // Auditoria de operador/guia requer tabela + IdP definidos antes de integrar essa rotina.
    return {result:"accepted",ticketId:r.rows[0].id};
  });
}
