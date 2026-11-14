-- Keep one rotating Supabase refresh token exchange in flight per login session.
-- A time-limited lease allows retry after a crashed or interrupted Worker.
ALTER TABLE auth_sessions ADD COLUMN refresh_lock_owner TEXT;
ALTER TABLE auth_sessions ADD COLUMN refresh_lock_until INTEGER NOT NULL DEFAULT 0;
