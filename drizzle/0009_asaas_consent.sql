-- Record the version and monetary conditions accepted before leaving for Asaas.
-- Do not store payer card credentials or the full contents of private profiles.
CREATE TABLE IF NOT EXISTS asaas_order_consents (
  order_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('PIX','CREDIT_CARD')),
  first_price_cents INTEGER NOT NULL CHECK(first_price_cents >= 0),
  renewal_price_cents INTEGER NOT NULL CHECK(renewal_price_cents > 0),
  accepted_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS asaas_order_consents_user ON asaas_order_consents(user_id,accepted_at);
