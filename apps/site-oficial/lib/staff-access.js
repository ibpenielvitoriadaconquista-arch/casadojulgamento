import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {query} from './db';
import {authConfig,fail} from './operation-auth';
export function authClient(privileged=false){
 const {url,key}=authConfig(),secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(privileged&&!secret)throw fail(503,'Convites ainda não configurados.');
 return createClient(url,privileged?secret:key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}
export async function throttle(req,scope,identity=''){
 // Vercel overwrites x-vercel-forwarded-for; never trust arbitrary X-Forwarded-For.
 const ip=String(req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown');
 const bucket=createHash('sha256').update(scope+':'+ip+':'+identity).digest('hex');
 const r=await query(`INSERT INTO peniel_ops.auth_throttle(bucket,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN peniel_ops.auth_throttle.expires_at<now() THEN 1 ELSE peniel_ops.auth_throttle.attempts+1 END,expires_at=CASE WHEN peniel_ops.auth_throttle.expires_at<now() THEN now()+interval '15 minutes' ELSE peniel_ops.auth_throttle.expires_at END RETURNING attempts`,[bucket]);
 if(r.rows[0].attempts>20)throw fail(429,'Muitas tentativas. Aguarde 15 minutos.');
}
