// Gateway PIX intencionalmente NÃO escolhido. FAIL CLOSED.
// Contrato futuro: createCharge(order, idempotencyKey) e verifyNotification(headers,payload),
// depois GET no provedor com credencial server-side para verificar paymentId/merchant/order/amount/BRL/status.
// A decisão sobre gateway pertence à coordenação e necessita contrato e ambiente sandbox.
export async function createChargeVerifiedProvider(){
  throw Object.assign(new Error("Integração PIX aguarda aprovação e credenciais do provedor"),{statusCode:503});
}
export async function fetchVerifiedGatewayEvent(){
  throw Object.assign(new Error("Webhook não configurado: rejeitar sem atualizar pedidos"),{statusCode:503});
}
