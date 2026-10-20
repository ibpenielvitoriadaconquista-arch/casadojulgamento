-- Schedule safe Even3 API snapshots at ten-minute intervals. No check-in or financial authorization.
-- The invocation key is read from Supabase Vault at runtime and never stored in cron metadata.
SELECT cron.schedule(
 'cdj-even3-api-pull-10m',
 '*/10 * * * *',
 $job$
 SELECT net.http_post(
   url := 'https://bdfohdqucosgykdhwdwj.supabase.co/functions/v1/cdj-even3-api-sync',
   body := '{"mode":"sync"}'::jsonb,
   headers := jsonb_build_object(
     'content-type','application/json',
     'x-cdj-sync-token',
     (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cdj_even3_sync_invocation' LIMIT 1)
   )
 );
 $job$
);
