-- Hosted Asaas card checkout is a pending payment journey, not an entitlement.
-- Existing Pix orders and subscription tables remain unchanged.
CREATE TABLE IF NOT EXISTS asaas_card_checkouts (
 order_id TEXT PRIMARY KEY NOT NULL,
 checkout_id TEXT NOT NULL UNIQUE,
 customer_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','PAID','CANCELED','EXPIRED')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS asaas_card_checkouts_customer ON asaas_card_checkouts(customer_id,status);
