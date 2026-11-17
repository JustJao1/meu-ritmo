-- Acknowledged but inconsistent Asaas events remain traceable without storing sensitive payloads.
CREATE TABLE IF NOT EXISTS asaas_webhook_reviews (
 event_id TEXT PRIMARY KEY NOT NULL,
 event_type TEXT NOT NULL,
 payment_id TEXT,
 order_id TEXT,
 reason TEXT NOT NULL,
 received_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS asaas_webhook_reviews_order ON asaas_webhook_reviews(order_id,received_at DESC);
