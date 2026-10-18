// Garante a integridade da mídia de convite durante o build.
// O pacote completo inclui o MP4; o deploy Vercel também aceita fragmentos de transporte.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const dst = path.join(root, 'public', 'video-convite.mp4');
const chunks = path.join(root, 'assets', 'video_chunks');
const sha1Esperado = "3f14ea60256ae572cfccee72e7275de837efacec";
if (!fs.existsSync(dst)) {
  if (!fs.existsSync(chunks)) throw new Error('Vídeo ausente e não existem fragmentos para reconstrução');
  const nomes = fs.readdirSync(chunks).filter((n) => /^part-\d{2}\.bin$/.test(n)).sort();
  if (nomes.length === 0) throw new Error('Fragmentos de vídeo ausentes');
  fs.mkdirSync(path.dirname(dst), {recursive:true});
  fs.writeFileSync(dst, Buffer.concat(nomes.map((n) => fs.readFileSync(path.join(chunks,n)))));
}
const atual = crypto.createHash('sha1').update(fs.readFileSync(dst)).digest('hex');
if (atual !== sha1Esperado) throw new Error('Integridade do vídeo de convite inválida');
console.log('Vídeo de convite conferido: '+fs.statSync(dst).size+' bytes');
