CREATE TABLE `billing_customers` (
	`user_id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`plan` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`received_at` integer NOT NULL
);
