CREATE TABLE auth_sessions(id_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,tokens TEXT NOT NULL,purpose TEXT NOT NULL CHECK(purpose IN ('login','recovery')),created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE auth_rates(key TEXT PRIMARY KEY,window INTEGER NOT NULL,attempts INTEGER NOT NULL);
CREATE TABLE auth_pending_profiles(user_id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,name TEXT NOT NULL,accepted_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
