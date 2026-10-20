-- QR rehearsal is isolated from live session_state and entry_authorizations.
-- Never delete Even3 or sales records when ending training.
CREATE TABLE IF NOT EXISTS peniel_ops.qr_rehearsal_sessions (
 session_date date PRIMARY KEY REFERENCES peniel_ops.session_state(session_date),
 generation uuid NOT NULL DEFAULT gen_random_uuid(),
 reset_at timestamptz,
 reset_by uuid REFERENCES peniel_ops.staff(user_id),
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO peniel_ops.qr_rehearsal_sessions(session_date)
 SELECT session_date FROM peniel_ops.session_state
 ON CONFLICT (session_date) DO NOTHING;

CREATE TABLE IF NOT EXISTS peniel_ops.qr_rehearsal_arrivals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id text NOT NULL DEFAULT '798621' CHECK(event_id='798621'),
 session_date date NOT NULL REFERENCES peniel_ops.qr_rehearsal_sessions(session_date),
 generation uuid NOT NULL,
 ticket_code text NOT NULL CHECK(ticket_code ~ '^[0-9]{6,20}$'),
 attendee_id text NOT NULL,
 participant_name text NOT NULL,
 ticket_category text NOT NULL,
 group_id text CHECK(group_id ~ '^G(0[1-9]|1[0-5])$'),
 scanned_at timestamptz NOT NULL DEFAULT now(),
 scanned_by uuid NOT NULL REFERENCES peniel_ops.staff(user_id),
 assigned_at timestamptz,
 assigned_by uuid REFERENCES peniel_ops.staff(user_id),
 UNIQUE(session_date,generation,ticket_code),
 CHECK ((group_id IS NULL AND assigned_at IS NULL AND assigned_by IS NULL)
     OR (group_id IS NOT NULL AND assigned_at IS NOT NULL AND assigned_by IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS qr_rehearsal_queue_idx
 ON peniel_ops.qr_rehearsal_arrivals(session_date,generation,scanned_at);
CREATE INDEX IF NOT EXISTS qr_rehearsal_group_idx
 ON peniel_ops.qr_rehearsal_arrivals(session_date,generation,group_id);

ALTER TABLE peniel_ops.qr_rehearsal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE peniel_ops.qr_rehearsal_arrivals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON peniel_ops.qr_rehearsal_sessions,peniel_ops.qr_rehearsal_arrivals FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE peniel_ops.qr_rehearsal_arrivals IS
 'TRAINING ONLY: real QR codes can be checked against Even3 read-only snapshots, but NEVER authorize access or touch live session_state. Reset rotates generation, preserving audit.';
