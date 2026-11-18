-- Atendimento individual: separado de avaliações, com histórico imutável de mensagens.
CREATE TABLE IF NOT EXISTS support_tickets (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('account','billing','technical','other')),
 subject TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','waiting_user','closed')),
 unread_user INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS support_tickets_user ON support_tickets(user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status ON support_tickets(status,updated_at DESC);
CREATE TABLE IF NOT EXISTS support_messages (
 id TEXT PRIMARY KEY NOT NULL,
 ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
 author_role TEXT NOT NULL CHECK(author_role IN ('user','admin')),
 body TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS support_messages_ticket ON support_messages(ticket_id,created_at);

-- Registros de contato e última desconexão; contas antigas são compatíveis.
CREATE TABLE IF NOT EXISTS auth_contact_methods (
 user_id TEXT PRIMARY KEY NOT NULL,
 phone TEXT,
 phone_verified_at INTEGER,
 preferred_channel TEXT NOT NULL DEFAULT 'email' CHECK(preferred_channel IN ('email','whatsapp')),
 disconnected_at INTEGER,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_login_challenges (
 id_hash TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 email TEXT NOT NULL,
 tokens TEXT NOT NULL,
 channel TEXT NOT NULL CHECK(channel IN ('email','whatsapp')),
 code_hash TEXT,
 expires_at INTEGER NOT NULL,
 last_sent_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS auth_login_challenges_expiry ON auth_login_challenges(expires_at);
CREATE INDEX IF NOT EXISTS auth_login_challenges_user ON auth_login_challenges(user_id);
CREATE TABLE IF NOT EXISTS auth_phone_challenges (
 id_hash TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 phone TEXT NOT NULL,
 code_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS auth_phone_challenges_expiry ON auth_phone_challenges(expires_at);
