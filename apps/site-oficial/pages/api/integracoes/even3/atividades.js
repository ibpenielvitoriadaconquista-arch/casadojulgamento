import webhook from '../../../../lib/even3-webhook.cjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'method_not_allowed' }); }
  if (!process.env.EVEN3_ADMIN_TOKEN || !process.env.EVEN3_API_TOKEN) return res.status(503).json({ error: 'integration_not_configured' });
  if (!webhook.authenticated(req.headers.authorization, `Bearer ${process.env.EVEN3_ADMIN_TOKEN}`)) return res.status(401).json({ error: 'unauthorized' });
  try {
    // Legacy read-only adapter; replace separately after verifying V2 contract.
    const response = await fetch('https://www.even3.com.br/api/v1/session', {
      headers: { 'Authorization-Token': process.env.EVEN3_API_TOKEN, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000), redirect: 'error', cache: 'no-store'
    });
    if (!response.ok) return res.status(502).json({ error: 'even3_unavailable', upstreamStatus: response.status });
    const body = await response.json();
    if (!Array.isArray(body.data)) throw new Error('Invalid contract');
    const expected = process.env.EVEN3_EVENT_ID;
    if (!expected || body.data.some(item => String(item.id_event) !== expected)) return res.status(502).json({ error: 'unexpected_event' });
    return res.status(200).json({ data: body.data.map(item => ({ id: item.id_session, eventId: item.id_event, title: item.title, capacity: item.capacity, times: item.times })) });
  } catch { return res.status(502).json({ error: 'even3_unavailable' }); }
}
