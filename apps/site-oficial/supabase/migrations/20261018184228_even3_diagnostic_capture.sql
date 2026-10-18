CREATE TABLE even3_integration.diagnostic_capture (payload_hash text PRIMARY KEY, received_at timestamptz NOT NULL DEFAULT now(), payload jsonb NOT NULL);
ALTER TABLE even3_integration.diagnostic_capture ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON even3_integration.diagnostic_capture FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE even3_integration.diagnostic_capture IS 'Temporary private capture of authenticated unrecognized webhook bodies; never grants registration, payment or admission. Review and remove after integration validation.';
