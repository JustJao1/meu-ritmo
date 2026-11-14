CREATE TABLE IF NOT EXISTS asaas_customers (
 user_id TEXT PRIMARY KEY NOT NULL,
 customer_id TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS asaas_orders (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 provider_subscription_id TEXT UNIQUE,
 plan_code TEXT NOT NULL,
 base_price_cents INTEGER NOT NULL,
 first_price_cents INTEGER NOT NULL,
 coupon_id TEXT,
 coupon_code TEXT,
 status TEXT NOT NULL DEFAULT 'creating',
 created_at INTEGER NOT NULL,
 cancelled_at INTEGER,
 first_paid_at INTEGER
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS asaas_orders_user_created ON asaas_orders(user_id,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS asaas_payments (
 payment_id TEXT PRIMARY KEY NOT NULL,
 order_id TEXT NOT NULL,
 status TEXT NOT NULL,
 amount_cents INTEGER NOT NULL,
 paid_at INTEGER,
 due_date TEXT,
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS asaas_payments_order ON asaas_payments(order_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS asaas_webhook_events (
 event_id TEXT PRIMARY KEY NOT NULL,
 event_type TEXT NOT NULL,
 received_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS asaas_coupon_uses (
 coupon_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 order_id TEXT NOT NULL UNIQUE,
 used_at INTEGER NOT NULL,
 PRIMARY KEY(coupon_id,user_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS asaas_one_open_order_per_user ON asaas_orders(user_id) WHERE status IN ('creating','pending','active','review');
