-- Copy of the migration already applied through Supabase on 2026-11-05.
ALTER TABLE peniel_ops.staff DROP CONSTRAINT staff_role_check;
ALTER TABLE peniel_ops.staff ADD CONSTRAINT staff_role_check CHECK(role IN ('geral','portaria','caixa','coordenacao','guias','apoio','telao','caravanas'));
