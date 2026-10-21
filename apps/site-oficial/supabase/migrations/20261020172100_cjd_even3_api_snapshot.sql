-- Even3 V1 API snapshot store: server-only staging, NO check-in/admission logic.
CREATE TABLE IF NOT EXISTS public.cdj_even3_api_catalog (
 event_id text NOT NULL CHECK (event_id='798621'),
 source text NOT NULL CHECK (source='v1'),
 catalog jsonb NOT NULL,
 retrieved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,source)
);
CREATE TABLE IF NOT EXISTS public.cdj_even3_api_attendees (
 event_id text NOT NULL CHECK (event_id='798621'),
 attendee_id text NOT NULL,
 checkin_code text,
 participant_name text,
 participant_email text,
 category_name text,
 is_confirmed boolean,
 upstream_version text NOT NULL CHECK (upstream_version='v1'),
 retrieved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,attendee_id)
);
CREATE INDEX IF NOT EXISTS cdj_even3_api_attendee_code_idx ON public.cdj_even3_api_attendees(event_id,checkin_code);
CREATE TABLE IF NOT EXISTS public.cdj_even3_api_payments (
 event_id text NOT NULL CHECK (event_id='798621'),
 payment_id text NOT NULL,
 reference text,
 payment_status text,
 amount_raw text,
 upstream_version text NOT NULL CHECK (upstream_version='v1'),
 retrieved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,payment_id)
);
CREATE INDEX IF NOT EXISTS cdj_even3_api_payment_reference_idx ON public.cdj_even3_api_payments(event_id,reference);
CREATE TABLE IF NOT EXISTS public.cdj_even3_api_sync_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mode text NOT NULL DEFAULT 'sync' CHECK (mode='sync'),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 api_version text NOT NULL DEFAULT 'v1',
 result text NOT NULL DEFAULT 'running' CHECK(result IN ('running','ok','partial','error')),
 counts jsonb NOT NULL DEFAULT '{}'::jsonb,
 error_codes jsonb NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.cdj_even3_api_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdj_even3_api_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdj_even3_api_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdj_even3_api_sync_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cdj_even3_api_catalog,public.cdj_even3_api_attendees,public.cdj_even3_api_payments,public.cdj_even3_api_sync_runs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.cdj_even3_api_catalog,public.cdj_even3_api_attendees,public.cdj_even3_api_payments,public.cdj_even3_api_sync_runs TO service_role;
COMMENT ON TABLE public.cdj_even3_api_payments IS 'Raw Even3 payment snapshot; payment status alone does NOT authorize attendee check-in.';
