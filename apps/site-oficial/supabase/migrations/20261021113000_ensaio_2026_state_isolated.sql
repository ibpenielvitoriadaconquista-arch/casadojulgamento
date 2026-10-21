-- Pending review only. Do not apply to production without approval.
-- Rehearsal states share official access controls but NOT operational session_state.
CREATE TABLE IF NOT EXISTS peniel_ops.ensaios_session_state (
 session_date date PRIMARY KEY REFERENCES peniel_ops.session_state(session_date),
 state jsonb NOT NULL,
 revision bigint NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO peniel_ops.ensaios_session_state(session_date,state,revision)
 SELECT session_date,
 jsonb_build_object(
  'counter',0,'paused',false,'coordinator','Titular','people','[]'::jsonb,
  'groups',(SELECT jsonb_agg(jsonb_build_object('id','G'||lpad(n::text,2,'0'),'status','forming','guide','','members','[]'::jsonb) ORDER BY n) FROM generate_series(1,15) n),
  'history','[]'::jsonb,'lastAssignment',NULL
 ),0 FROM peniel_ops.session_state
 ON CONFLICT (session_date) DO NOTHING;
CREATE TABLE IF NOT EXISTS peniel_ops.ensaios_command_log (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 session_date date NOT NULL REFERENCES peniel_ops.ensaios_session_state(session_date),
 actor_id uuid NOT NULL REFERENCES peniel_ops.staff(user_id),
 request_id uuid NOT NULL,
 payload_hash text NOT NULL,
 action text NOT NULL,
 message text NOT NULL,
 revision bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(session_date,actor_id,request_id)
);
ALTER TABLE peniel_ops.ensaios_session_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE peniel_ops.ensaios_command_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON peniel_ops.ensaios_session_state,peniel_ops.ensaios_command_log FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE peniel_ops.ensaios_session_state IS 'Ensaio isolado; não consome ingresso, venda ou presença na operação real.';
