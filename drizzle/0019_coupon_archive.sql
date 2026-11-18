-- Exclusão lógica dos cupons: preserva usos, pagamentos e auditoria existentes.
ALTER TABLE discount_codes ADD COLUMN archived_at INTEGER;
ALTER TABLE promotions ADD COLUMN archived_at INTEGER;
CREATE INDEX IF NOT EXISTS discount_codes_visible ON discount_codes(archived_at,created_at);
CREATE INDEX IF NOT EXISTS promotions_visible ON promotions(archived_at,created_at);
