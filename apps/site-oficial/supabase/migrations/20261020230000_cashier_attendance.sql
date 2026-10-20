-- Cashier line/service tracking. NEVER issues tickets or confirms Even3 payments.
CREATE TABLE IF NOT EXISTS peniel_ops.cashier_attendances(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id text NOT NULL DEFAULT '798621' CHECK(event_id='798621'),
 session_date date NOT NULL CHECK(session_date IN ('2026-11-09','2026-11-13','2026-11-14','2026-11-19','2026-11-20','2026-11-21')),
 channel text NOT NULL CHECK(channel IN ('balcao','tablet_fila')),
 participant_name text NOT NULL CHECK(length(trim(participant_name)) BETWEEN 2 AND 150),
 participant_contact text,
 intended_quantity integer NOT NULL DEFAULT 1 CHECK(intended_quantity BETWEEN 1 AND 20),
 payment_method text NOT NULL CHECK(payment_method IN ('pix_igreja','dinheiro','even3','outro')),
 financial_status text NOT NULL DEFAULT 'not_verified' CHECK(financial_status IN ('not_verified','reported_received','cancelled')),
 even3_sale_reference text,
 notes text,
 created_by uuid NOT NULL REFERENCES peniel_ops.staff(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(length(coalesce(participant_contact,''))<=120 AND length(coalesce(notes,''))<=500 AND length(coalesce(even3_sale_reference,''))<=120)
);
CREATE INDEX IF NOT EXISTS cashier_attendances_created_idx ON peniel_ops.cashier_attendances(created_at DESC);
ALTER TABLE peniel_ops.cashier_attendances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON peniel_ops.cashier_attendances FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE peniel_ops.cashier_attendances IS 'Cashier queue/intent tracking only. No real Even3 ticket minted, no evidence of payment, never grants entry.';
