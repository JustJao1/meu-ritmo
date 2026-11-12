CREATE INDEX `audit_created_at` ON `app_audit` (`created_at`);--> statement-breakpoint
CREATE INDEX `members_last_seen` ON `app_members` (`last_seen`);--> statement-breakpoint
CREATE INDEX `grants_user_expiry` ON `plan_grants` (`user_id`,`ends_at`);