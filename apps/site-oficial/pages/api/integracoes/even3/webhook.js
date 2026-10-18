import { transaction } from '../../../../lib/db';
import webhook from '../../../../lib/even3-webhook.cjs';
import registration from '../../../../lib/even3-registration.cjs';
export const config = { api: { bodyParser: { sizeLimit: '256kb' } } };
export default webhook.createWebhookHandler({
 save(event,body){return transaction(client=>registration.saveNotification(client,event,body));}
});
