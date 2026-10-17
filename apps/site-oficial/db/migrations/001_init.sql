-- Execute por DBA com conta de migração, NÃO com usuário público da aplicação.
BEGIN;
CREATE TABLE IF NOT EXISTS sessoes (
 id TEXT PRIMARY KEY, portoes TEXT NOT NULL, abertura_em TIMESTAMPTZ NOT NULL,
 online_cap INT NOT NULL DEFAULT 210 CHECK(online_cap=210),
 presencial_cap INT NOT NULL DEFAULT 90 CHECK(presencial_cap=90),
 ativa BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS pedidos (
 id UUID PRIMARY KEY, sessao_id TEXT NOT NULL REFERENCES sessoes(id),
 nome TEXT NOT NULL CHECK (char_length(nome) BETWEEN 2 AND 100),
 whatsapp TEXT NOT NULL CHECK (char_length(whatsapp) BETWEEN 12 AND 13),
 quantidade INT NOT NULL CHECK(quantidade BETWEEN 1 AND 6),
 valor_centavos INT NOT NULL CHECK(valor_centavos=quantidade*1500),
 alimentos_kg INT NOT NULL CHECK(alimentos_kg=quantidade),
 access_hash CHAR(64) NOT NULL,
 status TEXT NOT NULL DEFAULT 'reservado' CHECK(status IN ('reservado','aguardando_pix','pago','expirado','pagamento_tardio','cancelado','reembolso_pendente','reembolsado')),
 expira_em TIMESTAMPTZ NOT NULL,
 gateway_ref TEXT UNIQUE,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT now(), pago_em TIMESTAMPTZ,
 CONSTRAINT paid_needs_timestamp CHECK(status<>'pago' OR pago_em IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_pedidos_session ON pedidos(sessao_id,status,expira_em);
CREATE TABLE IF NOT EXISTS ingressos (
 id UUID PRIMARY KEY, pedido_id UUID NOT NULL REFERENCES pedidos(id),
 token_hash CHAR(64) NOT NULL UNIQUE, token_cipher TEXT NOT NULL,
 usado_em TIMESTAMPTZ,
 criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_tickets_order ON ingressos(pedido_id);
CREATE TABLE IF NOT EXISTS pagamento_eventos (
 gateway TEXT NOT NULL, evento_id TEXT NOT NULL,
 pedido_id UUID REFERENCES pedidos(id), recebido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(gateway, evento_id)
);
CREATE TABLE IF NOT EXISTS rate_limits (
 chave CHAR(64) NOT NULL, janela TIMESTAMPTZ NOT NULL,
 tentativas INT NOT NULL DEFAULT 0, PRIMARY KEY(chave,janela)
);
INSERT INTO sessoes (id,portoes,abertura_em) VALUES
 ('2026-11-09','17h','2026-11-09 17:00:00-03'),
 ('2026-11-13','20h','2026-11-13 20:00:00-03'),
 ('2026-11-14','18h','2026-11-14 18:00:00-03'),
 ('2026-11-19','20h','2026-11-19 20:00:00-03'),
 ('2026-11-20','17h','2026-11-20 17:00:00-03'),
 ('2026-11-21','18h','2026-11-21 18:00:00-03')
 ON CONFLICT(id) DO NOTHING;
COMMIT;
