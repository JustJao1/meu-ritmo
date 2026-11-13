CREATE TABLE IF NOT EXISTS appearance_links (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS appearance_links_user ON appearance_links(user_id);
CREATE INDEX IF NOT EXISTS appearance_links_expiry ON appearance_links(expires_at);
