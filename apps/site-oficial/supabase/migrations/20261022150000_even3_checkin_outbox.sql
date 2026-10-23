-- Durable local-first Even3 check-in queue. No external HTTP inside admission transaction.
CREATE TABLE IF NOT EXISTS peniel_ops.even3_checkin_outbox (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_id text NOT NULL,
 ticket_code text NOT NULL,
 attendee_id text NOT NULL,
 session_date date NOT NULL,
 checked_in_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','synced','retry','failed')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error text,
 synced_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_id,ticket_code)
);
CREATE INDEX IF NOT EXISTS even3_checkin_pending_idx
 ON peniel_ops.even3_checkin_outbox(next_attempt_at,id)
 WHERE status IN ('pending','retry');
ALTER TABLE peniel_ops.even3_checkin_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON peniel_ops.even3_checkin_outbox FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE peniel_ops.even3_checkin_outbox IS
 'Check-in after atomic local admission. Only server worker may deliver to Even3. Never enqueue rehearsal admissions.';
