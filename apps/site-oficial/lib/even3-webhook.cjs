const { createHash, timingSafeEqual } = require('node:crypto');

function authenticated(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string' || !expected) return false;
  const digest = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

function validateEnvelope(body, expectedEventId) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const id = body.id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  if (!body.type || typeof body.type.name !== 'string' || body.type.name.length > 300) return null;
  const eventId = body.evento?.id;
  if (!Number.isSafeInteger(Number(eventId)) || String(eventId) !== String(expectedEventId)) return null;
  if (!Number.isSafeInteger(body.created) || body.created <= 0 || body.created > 8640000000000) return null;
  return {
    notificationId: id.toLowerCase(), eventId: String(eventId),
    trigger: body.type.name, occurredAt: new Date(body.created * 1000).toISOString(),
    payloadHash: createHash('sha256').update(JSON.stringify(body)).digest('hex')
  };
}

function createWebhookHandler({ save, env = process.env }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET') return res.status(200).json({ service: 'even3-webhook', phase: 'inbox-only' });
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    if (!env.EVEN3_WEBHOOK_TOKEN) return res.status(503).json({ error: 'integration_not_configured' });
    const names = env.EVEN3_WEBHOOK_HEADER ? [env.EVEN3_WEBHOOK_HEADER.toLowerCase()] : ['x-token-even3', 'authorization-token', 'authorization', 'token'];
    const valid = names.some(name => {
      const value = req.headers[name];
      return authenticated(value, env.EVEN3_WEBHOOK_TOKEN) || (name === 'authorization' && typeof value === 'string' && /^Bearer /i.test(value) && authenticated(value.slice(7), env.EVEN3_WEBHOOK_TOKEN));
    });
    if (!valid) {
      console.warn('even3_webhook_auth_rejected', {headerNames: Object.keys(req.headers).filter(n=>/^[a-z0-9-]{1,64}$/.test(n)).slice(0,40)});
      return res.status(401).json({ error: 'unauthorized' });
    }
    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (contentType !== 'application/json') return res.status(415).json({ error: 'json_required' });
    if (!(env.DATABASE_URL || env.POSTGRES_URL) || !env.EVEN3_EVENT_ID) return res.status(503).json({ error: 'storage_not_configured' });
    const event = validateEnvelope(req.body, env.EVEN3_EVENT_ID);
    if (!event) return res.status(422).json({ error: 'unrecognized_envelope' });
    try {
      const result = await save(event, req.body);
      if (result.conflict) return res.status(409).json({ error: 'notification_conflict' });
      return res.status(200).json({ received: true, duplicate: result.duplicate, processing: 'pending_review' });
    } catch (error) {
      console.error("even3_inbox_storage_error", {code: String(error?.code || "unknown").replace(/[^a-zA-Z0-9_]/g, "").slice(0,64), name: error?.name || "Error"});
      // Never acknowledge a delivery that was not saved durably. Never log PII or secrets.
      res.setHeader('Retry-After', '60');
      return res.status(503).json({ error: 'storage_unavailable' });
    }
  };
}

module.exports = { authenticated, validateEnvelope, createWebhookHandler };
