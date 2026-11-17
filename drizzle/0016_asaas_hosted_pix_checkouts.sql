-- New one-off Asaas hosted Pix checkouts; legacy Pix subscriptions and card subscriptions stay intact.
CREATE TABLE IF NOT EXISTS asaas_hosted_pix_checkouts (
 order_id TEXT PRIMARY KEY NOT NULL,
 checkout_id TEXT NOT NULL UNIQUE,
 customer_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','PAID','CANCELED','EXPIRED')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS asaas_hosted_pix_customer ON asaas_hosted_pix_checkouts(customer_id,status);
