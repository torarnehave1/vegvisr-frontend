-- Per-user grants on the shared Blotato workspace.
-- A caller with no own config.blotato_api_key sees and may post to only the
-- Blotato account ids listed here for their email.
CREATE TABLE IF NOT EXISTS blotato_account_grants (
  email TEXT NOT NULL,
  account_id TEXT NOT NULL,
  granted_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (email, account_id)
);
