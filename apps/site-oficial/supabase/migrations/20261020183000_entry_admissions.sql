-- Only an independently reconciled financial AND individual ticket identity
-- can populate these records. Pluga inbox rows alone must not grant admission.
CREATE TABLE IF NOT EXISTS peniel_ops.entry_authorizations (
  event_id text NOT NULL CHECK (event_id='798621'),
  ticket_code text NOT NULL CHECK (ticket_code ~ '^[0-9]{6,20}$'),
  entry_id text NOT NULL CHECK (entry_id IN ('968577','968578','968579','968580','968581','968582')),
  participant_id text NOT NULL,
  participant_name text NOT NULL,
  registration_status text NOT NULL CHECK (registration_status IN ('confirmed','cancelled')),
  payment_status text NOT NULL CHECK (payment_status IN ('paid','exempt','refunded','pending')),
  evidence_reference text NOT NULL CHECK (length(trim(evidence_reference))>0),
  verified_at timestamptz NOT NULL,
  revoked_at timestamptz,
  checked_in_at timestamptz,
  admitted_by uuid REFERENCES peniel_ops.staff(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(event_id,ticket_code),
  CHECK ((checked_in_at IS NULL AND admitted_by IS NULL) OR (checked_in_at IS NOT NULL AND admitted_by IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS peniel_entry_authorizations_entry_idx ON peniel_ops.entry_authorizations(entry_id);
ALTER TABLE peniel_ops.entry_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON peniel_ops.entry_authorizations FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE peniel_ops.entry_authorizations IS
'Backend-only. ONLY reconcile here after proven individual ticket/payment linkage and authenticated Even3 category; NEVER populate from Pluga notifications alone.';
