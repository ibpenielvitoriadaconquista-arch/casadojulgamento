CREATE TABLE peniel_ops.encrypted_report_pages (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{1,100}$'),
  encrypted_html text NOT NULL CHECK (octet_length(encrypted_html) BETWEEN 64 AND 524288),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE peniel_ops.encrypted_report_pages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE peniel_ops.encrypted_report_pages FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE peniel_ops.encrypted_report_pages IS 'Password-encrypted HTML snapshots. Read by the application server only; no public Data API access.';
