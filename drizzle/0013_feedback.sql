CREATE TABLE IF NOT EXISTS user_feedback (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('problem','suggestion','rating')),
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 body TEXT NOT NULL,
 page TEXT NOT NULL,
 version TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','reviewing','planned','resolved')),
 unread INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS user_feedback_user ON user_feedback(user_id,created_at);
CREATE INDEX IF NOT EXISTS user_feedback_status ON user_feedback(status,created_at);
CREATE TABLE IF NOT EXISTS feedback_messages (
 id TEXT PRIMARY KEY NOT NULL,
 feedback_id TEXT NOT NULL REFERENCES user_feedback(id) ON DELETE CASCADE,
 author_role TEXT NOT NULL CHECK(author_role IN ('user','admin')),
 body TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_messages_thread ON feedback_messages(feedback_id,created_at);
