import { createHash } from 'node:crypto';
import { transaction, query } from '../../../../lib/db';
import webhook from '../../../../lib/even3-webhook.cjs';
import registration from '../../../../lib/even3-registration.cjs';
export const config = { api: { bodyParser: { sizeLimit: '256kb' } } };
export default webhook.createWebhookHandler({
 async quarantine(body){
  const raw=JSON.stringify(body);
  await query(`INSERT INTO even3_integration.diagnostic_capture(payload_hash,payload)
    VALUES($1,$2::jsonb) ON CONFLICT(payload_hash) DO NOTHING`,
    [createHash('sha256').update(raw).digest('hex'),raw]);
 },
 save(event,body){return transaction(client=>registration.saveNotification(client,event,body));}
});
