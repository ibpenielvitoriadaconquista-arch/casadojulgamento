/** Video público em fragmentos binários rastreados no deploy. Permite Range para Safari/Android. */
import fs from 'node:fs';
import path from 'node:path';

const MAX_PART_BYTES = 1024 * 1024;
export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  try {
    const folder = path.join(process.cwd(), 'assets', 'video_chunks');
    const names = fs.readdirSync(folder).filter(n => /^part-\d{2}\.bin$/.test(n)).sort();
    if (names.length !== 11) throw new Error('Arquivos de vídeo incompletos');
    const data = Buffer.concat(names.map(name => fs.readFileSync(path.join(folder,name))));
    const total = data.length;
    if (!total) throw new Error('Vídeo vazio');
    let start = 0;
    let end = Math.min(total - 1, MAX_PART_BYTES - 1);
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!m) { res.setHeader('Content-Range', `bytes */${total}`); return res.status(416).end(); }
      start = Number(m[1]);
      if (!Number.isSafeInteger(start) || start >= total) { res.setHeader('Content-Range', `bytes */${total}`); return res.status(416).end(); }
      end = Math.min(total - 1, start + MAX_PART_BYTES - 1, m[2] ? Number(m[2]) : total - 1);
      if (!Number.isSafeInteger(end) || end < start) { res.setHeader('Content-Range', `bytes */${total}`); return res.status(416).end(); }
    }
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', String(end - start + 1));
    res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=3600');
    if (req.method === 'HEAD') return res.status(206).end();
    return res.status(206).end(data.subarray(start, end + 1));
  } catch (err) {
    console.error('Vídeo indisponível', err.message);
    return res.status(503).json({ erro: 'Vídeo temporariamente indisponível' });
  }
}
