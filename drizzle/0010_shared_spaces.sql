CREATE TABLE IF NOT EXISTS shared_spaces (
 id TEXT PRIMARY KEY NOT NULL,
 owner_id TEXT NOT NULL,
 name TEXT NOT NULL,
 join_code TEXT NOT NULL UNIQUE,
 payload TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS shared_spaces_owner ON shared_spaces(owner_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS shared_space_members (
 space_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 joined_at INTEGER NOT NULL,
 PRIMARY KEY(space_id,user_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS shared_space_members_user ON shared_space_members(user_id);
