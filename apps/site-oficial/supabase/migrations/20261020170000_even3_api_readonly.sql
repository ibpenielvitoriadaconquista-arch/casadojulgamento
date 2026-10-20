-- Even3 API: private, read-only synchronized snapshots; no operational admission.
CREATE TABLE IF NOT EXISTS peniel_ops.even3_api_sync_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 api_version text,
 mode text NOT NULL CHECK (mode IN ('probe','sync')),
 result text NOT NULL DEFAULT 'running' CHECK (result IN ('running','ok','partial','error')),
 counts jsonb NOT NULL DEFAULT '{}'::jsonb,
 error_codes jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE IF NOT EXISTS peniel_ops.even3_api_attendees (
 event_id text NOT NULL CHECK(event_id='798621'),
 attendee_id text NOT NULL,
 checkin_code text,
 participant_name text,
 participant_email text,
 category_name text,
 is_confirmed boolean,
 upstream_version text NOT NULL CHECK(upstream_version IN ('v1','v2')),
 retrieved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,attendee_id)
);
CREATE INDEX IF NOT EXISTS even3_api_attendees_code_idx ON peniel_ops.even3_api_attendees(event_id,checkin_code);
CREATE TABLE IF NOT EXISTS peniel_ops.even3_api_payments (
 event_id text NOT NULL CHECK(event_id='798621'),
 payment_id text NOT NULL,
 reference text,
 payment_status text,
 amount_raw text,
 upstream_version text NOT NULL CHECK(upstream_version IN ('v1','v2')),
 retrieved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,payment_id)
);
CREATE INDEX IF NOT EXISTS even3_api_payments_reference_idx ON peniel_ops.even3_api_payments(event_id,reference);
CREATE TABLE IF NOT EXISTS peniel_ops.even3_api_catalog (
 event_id text NOT NULL CHECK(event_id='798621'),
 source text NOT NULL CHECK(source IN ('v1','v2')),
 catalog jsonb NOT NULL,
 retrieved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,source)
);
ALTER TABLE peniel_ops.even3_api_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE peniel_ops.even3_api_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE peniel_ops.even3_api_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE peniel_ops.even3_api_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON peniel_ops.even3_api_sync_runs,peniel_ops.even3_api_attendees,peniel_ops.even3_api_payments,peniel_ops.even3_api_catalog FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON peniel_ops.even3_api_sync_runs,peniel_ops.even3_api_attendees,peniel_ops.even3_api_payments,peniel_ops.even3_api_catalog TO service_role;
-- Supabase REST exposes only public by default. This function is callable solely by service_role.
-- Vault decryptions never appear in GitHub or client code.
CREATE OR REPLACE FUNCTION public.cdj_even3_api_secret()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path='' AS $sql$
 SELECT decrypted_secret FROM vault.decrypted_secrets
 WHERE name='cdj_even3_api_event_798621' LIMIT 1;
$sql$;
REVOKE ALL ON FUNCTION public.cdj_even3_api_secret() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cdj_even3_api_secret() TO service_role;
COMMENT ON FUNCTION public.cdj_even3_api_secret() IS 'Server-only API secret, no anon/authenticated access.';
