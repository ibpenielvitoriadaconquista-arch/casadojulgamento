-- HTTPS receiver staging only. Never grants entry, payment confirmation or participant check-in.
-- Preserves existing Pluga tables and all live operational data.
CREATE TABLE IF NOT EXISTS public.cdj_pluga_https_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_key text NOT NULL UNIQUE CHECK (char_length(delivery_key) BETWEEN 12 AND 128),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  event_id text NOT NULL CHECK (event_id = '798621'),
  event_kind text NOT NULL CHECK (event_kind IN ('smoke_test', 'registration_confirmed', 'sale_approved', 'sale_cancelled', 'sale_refunded')),
  ticket_code text CHECK (ticket_code IS NULL OR ticket_code ~ '^[0-9]{6,20}$'),
  sale_reference text,
  notification_id text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object' AND length(payload::text) <= 28000),
  processing_status text NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received','reviewed','rejected')),
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cdj_pluga_https_received_idx ON public.cdj_pluga_https_inbox(received_at DESC);
CREATE INDEX IF NOT EXISTS cdj_pluga_https_ticket_idx ON public.cdj_pluga_https_inbox(event_id,ticket_code) WHERE ticket_code IS NOT NULL;
ALTER TABLE public.cdj_pluga_https_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cdj_pluga_https_inbox FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT ON public.cdj_pluga_https_inbox TO service_role;
COMMENT ON TABLE public.cdj_pluga_https_inbox IS
'Private staging for authenticated HTTPS Pluga events. Unverified raw data, never permits admission; reconcile against official Even3 and financial data first.';
