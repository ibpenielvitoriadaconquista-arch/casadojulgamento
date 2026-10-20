-- Solicitações de cadastro e funções de colaboradores; executar após revisão no Supabase OFICIAL.
-- Migração aditiva: não altera inscrições, ingressos ou vendas.
BEGIN;
ALTER TABLE peniel_ops.staff
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE peniel_ops.staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE peniel_ops.staff
  ADD CONSTRAINT staff_role_check CHECK (
    role IN ('geral','portaria','caixa','coordenacao','guias','apoio','telao')
  );
CREATE TABLE IF NOT EXISTS peniel_ops.access_requests(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK(length(full_name) BETWEEN 2 AND 120),
  email text NOT NULL,
  whatsapp text NOT NULL CHECK (whatsapp ~ '^\\+?[0-9]{10,15}$'),
  requested_role text NOT NULL CHECK(requested_role IN('guias','coordenacao','caixa','apoio','portaria')),
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN('pending','approved','rejected')),
  reviewed_by uuid REFERENCES peniel_ops.staff(user_id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_request_email UNIQUE(email)
);
CREATE INDEX IF NOT EXISTS access_requests_status_created_idx
 ON peniel_ops.access_requests(status,created_at);
ALTER TABLE peniel_ops.access_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE peniel_ops.access_requests FROM PUBLIC,anon,authenticated;
-- Backend acessa pelo Postgres; nenhuma permissão pública de leitura ou escrita.
COMMIT;
