-- Reserve a unique username while email verification is pending.
-- Existing profile names already have a UNIQUE index; this closes the pending-signup race.
CREATE TABLE IF NOT EXISTS auth_pending_profiles (
  user_id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL,
  name TEXT NOT NULL,
  accepted_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS auth_pending_profiles_username_unique
  ON auth_pending_profiles(username COLLATE NOCASE);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_nocase_unique
  ON profiles(username COLLATE NOCASE);
--> statement-breakpoint
ALTER TABLE social_reports ADD COLUMN profile_id TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS social_reports_profile_id ON social_reports(profile_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS social_report_once_per_target
  ON social_reports(reporter_id,profile_id) WHERE profile_id IS NOT NULL AND resolved_at IS NULL;
