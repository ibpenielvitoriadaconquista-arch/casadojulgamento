"use strict";
const crypto = require("node:crypto");
function randomToken() { return crypto.randomBytes(32).toString("base64url"); }
function tokenHash(t) { return crypto.createHash("sha256").update(t, "utf8").digest("hex"); }
function secureEqual(a,b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa,bb);
}
function encryptTicketToken(token, hexKey) {
  const key = Buffer.from(hexKey || "", "hex");
  if (key.length !== 32) throw new Error("TICKET_ENCRYPTION_KEY_HEX exige 32 bytes");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"),cipher.final()]);
  return [iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(".");
}
function decryptTicketToken(payload, hexKey) {
  const key=Buffer.from(hexKey||"","hex");
  if(key.length!==32) throw new Error("Chave inválida");
  const pieces=String(payload).split(".");
  if(pieces.length!==3) throw new Error("Cifrado inválido");
  const [iv,tag,enc]=pieces.map(x=>Buffer.from(x,"base64url"));
  const d=crypto.createDecipheriv("aes-256-gcm",key,iv);d.setAuthTag(tag);
  return Buffer.concat([d.update(enc),d.final()]).toString("utf8");
}
function parseCookie(header,key) {
  const pairs=String(header||"").split(";");
  const raw=pairs.map(x=>x.trim()).find(x=>x.startsWith(key+"="));
  return raw ? decodeURIComponent(raw.slice(key.length+1)) : "";
}
function cookieHeader(name,value,maxAge=86400) {
  const secure=process.env.NODE_ENV==="production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
function sameOrigin(req) {
  const expected = process.env.PUBLIC_BASE_URL;
  if (!expected) return false;
  try { return new URL(req.headers.origin).origin === new URL(expected).origin; } catch { return false; }
}
module.exports={randomToken,tokenHash,secureEqual,encryptTicketToken,decryptTicketToken,parseCookie,cookieHeader,sameOrigin};
