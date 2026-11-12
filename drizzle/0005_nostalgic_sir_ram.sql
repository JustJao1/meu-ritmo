CREATE TABLE `discount_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`plan` text NOT NULL,
	`kind` text NOT NULL,
	`value` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`max_uses` integer NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`stripe_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discount_codes_code_unique` ON `discount_codes` (`code`);--> statement-breakpoint
CREATE TABLE `privacy_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`username` text,
	`name` text,
	`bio` text DEFAULT '' NOT NULL,
	`avatar_key` text,
	`username_changed_at` integer,
	`name_changed_at` integer,
	`accepted_at` integer,
	`version` text,
	`suspended` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_id_unique` ON `profiles` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_username_unique` ON `profiles` (`username`);--> statement-breakpoint
CREATE TABLE `service_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `social_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`blocked_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_block_unique` ON `social_blocks` (`user_id`,`blocked_id`);--> statement-breakpoint
CREATE TABLE `social_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`removed_at` integer
);
--> statement-breakpoint
CREATE INDEX `social_comments_post` ON `social_comments` (`post_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`template` text,
	`created_at` integer NOT NULL,
	`removed_at` integer
);
--> statement-breakpoint
CREATE INDEX `social_feed` ON `social_posts` (`category`,`created_at`);--> statement-breakpoint
CREATE TABLE `social_rates` (
	`key` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`attempts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `social_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`post_id` text,
	`comment_id` text,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer
);
