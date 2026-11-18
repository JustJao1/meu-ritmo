-- Sanitized operational diagnostics: stage + HTTP code only, never payer details.
CREATE TABLE IF NOT EXISTS asaas_checkout_failures (
 order_id TEXT PRIMARY KEY NOT NULL,
 stage TEXT NOT NULL,
 provider_http_status INTEGER,
 failed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS asaas_checkout_failures_stage ON asaas_checkout_failures(stage,failed_at);
