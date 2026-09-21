-- Bot tables for Hallo Vegvisr Chat Bot system
-- Only Superadmin can create bots and add them to groups

CREATE TABLE IF NOT EXISTS chat_bots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  system_prompt TEXT NOT NULL DEFAULT '',
  graph_id TEXT,
  created_by TEXT NOT NULL,
  tools TEXT NOT NULL DEFAULT '[]',
  model TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  max_turns INTEGER NOT NULL DEFAULT 10,
  temperature REAL NOT NULL DEFAULT 0.7,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS group_bot_members (
  group_id TEXT NOT NULL,
  bot_id TEXT NOT NULL,
  added_by TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, bot_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_bots_username ON chat_bots (username);
CREATE INDEX IF NOT EXISTS idx_group_bot_members_bot ON group_bot_members (bot_id);
