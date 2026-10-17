import { query } from '../../../../lib/db';
import webhook from '../../../../lib/even3-webhook.cjs';

export const config = { api: { bodyParser: { sizeLimit: '256kb' } } };

export default webhook.createWebhookHandler({
  async save(event, body) {
    const result = await query(`
      INSERT INTO even3_integration.webhook_inbox
        (event_id, notification_id, trigger_name, occurred_at, payload_hash, payload)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      ON CONFLICT (event_id, notification_id) DO NOTHING
      RETURNING notification_id`,
    [event.eventId, event.notificationId, event.trigger, event.occurredAt, event.payloadHash, JSON.stringify(body)]);
    if (result.rowCount) return { duplicate: false, conflict: false };
    const existing = await query(`SELECT payload_hash FROM even3_integration.webhook_inbox
      WHERE event_id = $1 AND notification_id = $2`, [event.eventId, event.notificationId]);
    return { duplicate: true, conflict: existing.rows[0]?.payload_hash !== event.payloadHash };
  }
});
