BEGIN;
CREATE SCHEMA IF NOT EXISTS even3_integration;
REVOKE ALL ON SCHEMA even3_integration FROM PUBLIC;
CREATE TABLE IF NOT EXISTS even3_integration.webhook_inbox (
  event_id text NOT NULL,
  notification_id text NOT NULL,
  trigger_name text NOT NULL,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload_hash text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','processed','rejected')),
  processed_at timestamptz,
  PRIMARY KEY (event_id, notification_id)
);
ALTER TABLE even3_integration.webhook_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON even3_integration.webhook_inbox FROM PUBLIC;
CREATE TABLE IF NOT EXISTS even3_integration.activity_map (
  event_id text NOT NULL,
  activity_id text NOT NULL,
  session_date date NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, activity_id),
  UNIQUE (event_id, session_date)
);
ALTER TABLE even3_integration.activity_map ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON even3_integration.activity_map FROM PUBLIC;
COMMIT;
