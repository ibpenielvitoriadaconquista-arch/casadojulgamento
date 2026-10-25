CREATE TABLE peniel_ops.staff_email_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES peniel_ops.access_requests(id),
 recipient text NOT NULL,
 full_name text NOT NULL,
 requested_role text NOT NULL CHECK(requested_role IN ('guias','coordenacao','caixa','apoio','portaria')),
 message jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','accepted','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 sender text,
 provider_message_id text,
 last_error text,
 first_attempt_at timestamptz,
 last_attempt_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_email_outbox_request_idx ON peniel_ops.staff_email_outbox(request_id);
ALTER TABLE peniel_ops.staff_email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON peniel_ops.staff_email_outbox FROM PUBLIC,anon,authenticated;
GRANT ALL ON peniel_ops.staff_email_outbox TO service_role;
