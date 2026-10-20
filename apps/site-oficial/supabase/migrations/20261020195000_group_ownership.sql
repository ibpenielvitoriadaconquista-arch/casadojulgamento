-- Each live group has exactly one coordinator and one guide per session.
-- This table must be committed before enabling ownership enforcement in production.
CREATE TABLE IF NOT EXISTS peniel_ops.group_ownership (
 session_date date NOT NULL REFERENCES peniel_ops.session_state(session_date),
 group_id text NOT NULL CHECK (group_id ~ '^G(0[1-9]|1[0-5])$'),
 coordinator_id uuid REFERENCES peniel_ops.staff(user_id),
 guide_id uuid REFERENCES peniel_ops.staff(user_id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_date,group_id)
);
CREATE TABLE IF NOT EXISTS peniel_ops.group_ownership_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 session_date date NOT NULL,
 group_id text NOT NULL,
 slot text NOT NULL CHECK (slot IN ('coordinator','guide')),
 before_user uuid,
 after_user uuid,
 changed_by uuid NOT NULL REFERENCES peniel_ops.staff(user_id),
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE peniel_ops.group_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE peniel_ops.group_ownership_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON peniel_ops.group_ownership FROM PUBLIC,anon,authenticated;
REVOKE ALL ON peniel_ops.group_ownership_audit FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE peniel_ops.group_ownership IS 'Server-controlled exclusive ownership per session/group: single coordinator and guide.';
