-- Official seven-entry flow. Additive migration; existing rehearsal data is preserved.
CREATE TABLE IF NOT EXISTS peniel_ops.entry_authorizations (
 event_id text NOT NULL CHECK(event_id='798621'),ticket_code text NOT NULL,
 entry_id text NOT NULL,participant_id text NOT NULL,participant_name text NOT NULL,
 registration_status text NOT NULL CHECK(registration_status IN ('confirmed','cancelled')),
 payment_status text NOT NULL CHECK(payment_status IN ('paid','exempt','refunded','pending')),
 evidence_reference text NOT NULL CHECK(length(trim(evidence_reference))>0),verified_at timestamptz NOT NULL,
 revoked_at timestamptz,checked_in_at timestamptz,admitted_by uuid REFERENCES peniel_ops.staff(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,ticket_code)
);
ALTER TABLE peniel_ops.entry_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON peniel_ops.entry_authorizations FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS peniel_ops.entry_checkins (
 event_id text NOT NULL CHECK(event_id='798621'),ticket_code text NOT NULL,
 entry_id text NOT NULL,attendee_id text NOT NULL,participant_name text NOT NULL,
 session_date date NOT NULL REFERENCES peniel_ops.session_state(session_date),
 status text NOT NULL CHECK(status IN ('sending','uncertain','confirmed','admitted','rejected')),
 requested_at timestamptz NOT NULL DEFAULT now(),confirmed_at timestamptz,admitted_at timestamptz,
 requested_by uuid NOT NULL REFERENCES peniel_ops.staff(user_id),
 response_code text,last_error text,resolved_by uuid REFERENCES peniel_ops.staff(user_id),resolution_evidence text,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(event_id,ticket_code),
 FOREIGN KEY(event_id,ticket_code) REFERENCES peniel_ops.entry_authorizations(event_id,ticket_code)
);
ALTER TABLE peniel_ops.entry_checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON peniel_ops.entry_checkins FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS peniel_ops.entry_financial_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,event_id text NOT NULL,ticket_code text NOT NULL,
 actor_id uuid NOT NULL REFERENCES peniel_ops.staff(user_id),action text NOT NULL,evidence text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE peniel_ops.entry_financial_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON peniel_ops.entry_financial_audit FROM PUBLIC,anon,authenticated;
INSERT INTO peniel_ops.session_state(session_date,state) VALUES ('2026-10-22','{"counter":0,"paused":false,"coordinator":"Titular","people":[],"groups":[{"id":"G01","status":"forming","guide":"","members":[]},{"id":"G02","status":"forming","guide":"","members":[]},{"id":"G03","status":"forming","guide":"","members":[]},{"id":"G04","status":"forming","guide":"","members":[]},{"id":"G05","status":"forming","guide":"","members":[]},{"id":"G06","status":"forming","guide":"","members":[]},{"id":"G07","status":"forming","guide":"","members":[]},{"id":"G08","status":"forming","guide":"","members":[]},{"id":"G09","status":"forming","guide":"","members":[]},{"id":"G10","status":"forming","guide":"","members":[]},{"id":"G11","status":"forming","guide":"","members":[]},{"id":"G12","status":"forming","guide":"","members":[]},{"id":"G13","status":"forming","guide":"","members":[]},{"id":"G14","status":"forming","guide":"","members":[]},{"id":"G15","status":"forming","guide":"","members":[]}],"history":[],"lastAssignment":null}'::jsonb) ON CONFLICT(session_date) DO NOTHING;
