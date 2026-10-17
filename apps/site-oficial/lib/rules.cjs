"use strict";
const PRICE_CENTS = 1500;
const MAX_PER_ORDER = 6;
const ONLINE_CAPACITY = 210;
const TOTAL_CAPACITY = 300;
const RESERVATION_MINUTES = 15;
const SESSIONS = Object.freeze([
  { id: "2026-11-09", data: "09/11/2026", dia: "Segunda-feira", portoes: "17h" },
  { id: "2026-11-13", data: "13/11/2026", dia: "Sexta-feira", portoes: "20h" },
  { id: "2026-11-14", data: "14/11/2026", dia: "Sábado", portoes: "18h" },
  { id: "2026-11-19", data: "19/11/2026", dia: "Quinta-feira", portoes: "20h" },
  { id: "2026-11-20", data: "20/11/2026", dia: "Sexta-feira", portoes: "17h" },
  { id: "2026-11-21", data: "21/11/2026", dia: "Sábado", portoes: "18h" },
]);
function normalizeName(value) {
  if (typeof value !== "string") throw new Error("Nome inválido");
  const v = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (v.length < 2 || v.length > 100 || /[<>\u0000-\u001F]/.test(v)) throw new Error("Nome deve ter de 2 a 100 caracteres");
  return v;
}
function normalizeBrazilPhone(value) {
  if (typeof value !== "string") throw new Error("WhatsApp inválido");
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (!/^[1-9][0-9][2-9][0-9]{7,8}$/.test(digits)) throw new Error("Informe o WhatsApp com DDD");
  return "55" + digits;
}
function validateOrder(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Pedido inválido");
  const { sessaoId, quantidade } = data;
  if (!SESSIONS.some(s=>s.id===sessaoId)) throw new Error("Sessão indisponível");
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_PER_ORDER) throw new Error("Quantidade inválida");
  return { sessaoId, quantidade, nome: normalizeName(data.nome), whatsapp: normalizeBrazilPhone(data.whatsapp), valorCentavos: quantidade * PRICE_CENTS, alimentosKg: quantidade };
}
function formatBRL(cents) { return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
module.exports = { PRICE_CENTS, MAX_PER_ORDER, ONLINE_CAPACITY, TOTAL_CAPACITY, RESERVATION_MINUTES, SESSIONS, validateOrder, normalizeName, normalizeBrazilPhone, formatBRL };
