ALTER TABLE peniel_ops.staff DROP CONSTRAINT staff_role_check;
ALTER TABLE peniel_ops.staff ADD CONSTRAINT staff_role_check CHECK(role IN ('geral','portaria','coordenacao','guias','telao','apoio'));
CREATE TABLE peniel_ops.staff_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES peniel_ops.staff(user_id),
 target_id uuid NOT NULL REFERENCES auth.users(id),
 action text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_audit_actor ON peniel_ops.staff_audit(actor_id);
CREATE INDEX staff_audit_target ON peniel_ops.staff_audit(target_id);
CREATE TABLE peniel_ops.rehearsal (
 station integer PRIMARY KEY CHECK(station BETWEEN 1 AND 6),
 state jsonb NOT NULL DEFAULT '{"revision":0,"current":null,"history":[]}',
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO peniel_ops.rehearsal(station) SELECT generate_series(1,6);
CREATE TABLE peniel_ops.rehearsal_commands (
 actor_id uuid NOT NULL REFERENCES peniel_ops.staff(user_id),
 request_id uuid NOT NULL,
 payload_hash text NOT NULL,
 station integer NOT NULL REFERENCES peniel_ops.rehearsal(station),
 action text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,request_id)
);
CREATE INDEX rehearsal_commands_station ON peniel_ops.rehearsal_commands(station);
CREATE TABLE peniel_ops.auth_throttle (
 bucket text PRIMARY KEY,
 attempts integer NOT NULL DEFAULT 1,
 expires_at timestamptz NOT NULL
);
ALTER TABLE peniel_ops.staff_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE peniel_ops.rehearsal ENABLE ROW LEVEL SECURITY;
ALTER TABLE peniel_ops.rehearsal_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE peniel_ops.auth_throttle ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA peniel_ops FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA peniel_ops FROM PUBLIC,anon,authenticated;
