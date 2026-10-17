CREATE SCHEMA peniel_ops;
REVOKE ALL ON SCHEMA peniel_ops FROM PUBLIC, anon, authenticated;
CREATE TABLE peniel_ops.staff (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 role text NOT NULL CHECK (role IN ('geral','portaria','coordenacao','guias','telao')),
 active boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE peniel_ops.session_state (
 session_date date PRIMARY KEY,
 state jsonb NOT NULL CHECK(jsonb_typeof(state)='object'),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE peniel_ops.registrations (
 event_id text NOT NULL,
 registration_id text NOT NULL,
 participant_id text NOT NULL,
 participant_name text NOT NULL,
 registration_status text NOT NULL DEFAULT 'pending' CHECK(registration_status IN ('pending','confirmed','cancelled')),
 payment_status text NOT NULL DEFAULT 'unknown' CHECK(payment_status IN ('unknown','pending','paid','refunded','exempt')),
 activity_id text,
 activity_status text NOT NULL DEFAULT 'pending' CHECK(activity_status IN ('pending','confirmed','cancelled')),
 checked_in_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,registration_id),
 FOREIGN KEY(event_id,activity_id) REFERENCES even3_integration.activity_map(event_id,activity_id)
);
CREATE INDEX registrations_participant ON peniel_ops.registrations(event_id,participant_id);
CREATE INDEX registrations_activity ON peniel_ops.registrations(event_id,activity_id);
CREATE TABLE peniel_ops.command_log (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 session_date date NOT NULL REFERENCES peniel_ops.session_state(session_date),
 actor_id uuid NOT NULL REFERENCES peniel_ops.staff(user_id),
 request_id uuid NOT NULL,
 payload_hash text NOT NULL,
 action text NOT NULL,
 message text NOT NULL,
 revision bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(session_date,actor_id,request_id)
);
CREATE INDEX command_log_actor ON peniel_ops.command_log(actor_id);
ALTER TABLE peniel_ops.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE peniel_ops.session_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE peniel_ops.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE peniel_ops.command_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA peniel_ops FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA peniel_ops FROM PUBLIC,anon,authenticated;
COMMENT ON SCHEMA peniel_ops IS 'Backend-only operational data. Open training remains browser-local. Sessions use row locks and revisions; the API enforces staff roles.';
INSERT INTO peniel_ops.session_state(session_date,state) VALUES ('2026-11-09','{"counter":0,"paused":false,"coordinator":"Titular","people":[],"groups":[{"id":"G01","status":"forming","guide":"","members":[]},{"id":"G02","status":"forming","guide":"","members":[]},{"id":"G03","status":"forming","guide":"","members":[]},{"id":"G04","status":"forming","guide":"","members":[]},{"id":"G05","status":"forming","guide":"","members":[]},{"id":"G06","status":"forming","guide":"","members":[]},{"id":"G07","status":"forming","guide":"","members":[]},{"id":"G08","status":"forming","guide":"","members":[]},{"id":"G09","status":"forming","guide":"","members":[]},{"id":"G10","status":"forming","guide":"","members":[]},{"id":"G11","status":"forming","guide":"","members":[]},{"id":"G12","status":"forming","guide":"","members":[]},{"id":"G13","status":"forming","guide":"","members":[]},{"id":"G14","status":"forming","guide":"","members":[]},{"id":"G15","status":"forming","guide":"","members":[]}],"history":[],"lastAssignment":null}'::jsonb);
INSERT INTO peniel_ops.session_state(session_date,state) VALUES ('2026-11-13','{"counter":0,"paused":false,"coordinator":"Titular","people":[],"groups":[{"id":"G01","status":"forming","guide":"","members":[]},{"id":"G02","status":"forming","guide":"","members":[]},{"id":"G03","status":"forming","guide":"","members":[]},{"id":"G04","status":"forming","guide":"","members":[]},{"id":"G05","status":"forming","guide":"","members":[]},{"id":"G06","status":"forming","guide":"","members":[]},{"id":"G07","status":"forming","guide":"","members":[]},{"id":"G08","status":"forming","guide":"","members":[]},{"id":"G09","status":"forming","guide":"","members":[]},{"id":"G10","status":"forming","guide":"","members":[]},{"id":"G11","status":"forming","guide":"","members":[]},{"id":"G12","status":"forming","guide":"","members":[]},{"id":"G13","status":"forming","guide":"","members":[]},{"id":"G14","status":"forming","guide":"","members":[]},{"id":"G15","status":"forming","guide":"","members":[]}],"history":[],"lastAssignment":null}'::jsonb);
INSERT INTO peniel_ops.session_state(session_date,state) VALUES ('2026-11-14','{"counter":0,"paused":false,"coordinator":"Titular","people":[],"groups":[{"id":"G01","status":"forming","guide":"","members":[]},{"id":"G02","status":"forming","guide":"","members":[]},{"id":"G03","status":"forming","guide":"","members":[]},{"id":"G04","status":"forming","guide":"","members":[]},{"id":"G05","status":"forming","guide":"","members":[]},{"id":"G06","status":"forming","guide":"","members":[]},{"id":"G07","status":"forming","guide":"","members":[]},{"id":"G08","status":"forming","guide":"","members":[]},{"id":"G09","status":"forming","guide":"","members":[]},{"id":"G10","status":"forming","guide":"","members":[]},{"id":"G11","status":"forming","guide":"","members":[]},{"id":"G12","status":"forming","guide":"","members":[]},{"id":"G13","status":"forming","guide":"","members":[]},{"id":"G14","status":"forming","guide":"","members":[]},{"id":"G15","status":"forming","guide":"","members":[]}],"history":[],"lastAssignment":null}'::jsonb);
INSERT INTO peniel_ops.session_state(session_date,state) VALUES ('2026-11-19','{"counter":0,"paused":false,"coordinator":"Titular","people":[],"groups":[{"id":"G01","status":"forming","guide":"","members":[]},{"id":"G02","status":"forming","guide":"","members":[]},{"id":"G03","status":"forming","guide":"","members":[]},{"id":"G04","status":"forming","guide":"","members":[]},{"id":"G05","status":"forming","guide":"","members":[]},{"id":"G06","status":"forming","guide":"","members":[]},{"id":"G07","status":"forming","guide":"","members":[]},{"id":"G08","status":"forming","guide":"","members":[]},{"id":"G09","status":"forming","guide":"","members":[]},{"id":"G10","status":"forming","guide":"","members":[]},{"id":"G11","status":"forming","guide":"","members":[]},{"id":"G12","status":"forming","guide":"","members":[]},{"id":"G13","status":"forming","guide":"","members":[]},{"id":"G14","status":"forming","guide":"","members":[]},{"id":"G15","status":"forming","guide":"","members":[]}],"history":[],"lastAssignment":null}'::jsonb);
INSERT INTO peniel_ops.session_state(session_date,state) VALUES ('2026-11-20','{"counter":0,"paused":false,"coordinator":"Titular","people":[],"groups":[{"id":"G01","status":"forming","guide":"","members":[]},{"id":"G02","status":"forming","guide":"","members":[]},{"id":"G03","status":"forming","guide":"","members":[]},{"id":"G04","status":"forming","guide":"","members":[]},{"id":"G05","status":"forming","guide":"","members":[]},{"id":"G06","status":"forming","guide":"","members":[]},{"id":"G07","status":"forming","guide":"","members":[]},{"id":"G08","status":"forming","guide":"","members":[]},{"id":"G09","status":"forming","guide":"","members":[]},{"id":"G10","status":"forming","guide":"","members":[]},{"id":"G11","status":"forming","guide":"","members":[]},{"id":"G12","status":"forming","guide":"","members":[]},{"id":"G13","status":"forming","guide":"","members":[]},{"id":"G14","status":"forming","guide":"","members":[]},{"id":"G15","status":"forming","guide":"","members":[]}],"history":[],"lastAssignment":null}'::jsonb);
INSERT INTO peniel_ops.session_state(session_date,state) VALUES ('2026-11-21','{"counter":0,"paused":false,"coordinator":"Titular","people":[],"groups":[{"id":"G01","status":"forming","guide":"","members":[]},{"id":"G02","status":"forming","guide":"","members":[]},{"id":"G03","status":"forming","guide":"","members":[]},{"id":"G04","status":"forming","guide":"","members":[]},{"id":"G05","status":"forming","guide":"","members":[]},{"id":"G06","status":"forming","guide":"","members":[]},{"id":"G07","status":"forming","guide":"","members":[]},{"id":"G08","status":"forming","guide":"","members":[]},{"id":"G09","status":"forming","guide":"","members":[]},{"id":"G10","status":"forming","guide":"","members":[]},{"id":"G11","status":"forming","guide":"","members":[]},{"id":"G12","status":"forming","guide":"","members":[]},{"id":"G13","status":"forming","guide":"","members":[]},{"id":"G14","status":"forming","guide":"","members":[]},{"id":"G15","status":"forming","guide":"","members":[]}],"history":[],"lastAssignment":null}'::jsonb);
