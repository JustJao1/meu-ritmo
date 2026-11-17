ALTER TABLE shared_spaces ADD COLUMN last_change_token TEXT;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS shared_space_notifications (
 id TEXT PRIMARY KEY NOT NULL,
 space_id TEXT NOT NULL,
 recipient_id TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 item_count INTEGER NOT NULL,
 item_title TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 read_at INTEGER
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS shared_space_notifications_inbox ON shared_space_notifications(recipient_id,read_at,created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS shared_space_notifications_space ON shared_space_notifications(space_id,recipient_id);
