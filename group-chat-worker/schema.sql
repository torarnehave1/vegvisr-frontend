-- Group chat schema for hallo_vegvisr_chat
-- Mirrors the production database (read from sqlite_master on 2026-09-21).
-- Private conversations add direct_chats and its triggers: see add-direct-chats.sql.

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  graph_id TEXT,
  created_at INTEGER NOT NULL,
  image_url TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,
  archived_by TEXT,
  notifications_muted INTEGER NOT NULL DEFAULT 0,
  alert_sender_email TEXT,
  posting_locked INTEGER NOT NULL DEFAULT 0,
  pinned_message_id INTEGER,
  external_kind TEXT
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at INTEGER NOT NULL,
  alerts_enabled INTEGER DEFAULT 0,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  audio_url TEXT,
  audio_duration_ms INTEGER,
  transcript_text TEXT,
  transcript_lang TEXT,
  transcription_status TEXT,
  media_url TEXT,
  media_object_key TEXT,
  media_content_type TEXT,
  media_size INTEGER,
  video_thumbnail_url TEXT,
  video_duration_ms INTEGER,
  sender_avatar_url TEXT,
  reply_to_id INTEGER,
  forwarded_from_message_id INTEGER,
  forwarded_from_user_id TEXT,
  forwarded_from_user_name TEXT
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  use_count INTEGER DEFAULT 0,
  FOREIGN KEY (group_id) REFERENCES groups(id)
);

CREATE TABLE IF NOT EXISTS device_tokens (
  fcm_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

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

CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,        -- JSON array of option strings
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  closed_at INTEGER,            -- NULL = still open
  FOREIGN KEY (group_id) REFERENCES groups(id)
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  option_index INTEGER NOT NULL, -- 0-based index into options
  voted_at INTEGER NOT NULL,
  PRIMARY KEY (poll_id, user_id),
  FOREIGN KEY (poll_id) REFERENCES polls(id)
);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  reaction TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id, reaction)
);

CREATE TABLE IF NOT EXISTS group_message_acks (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  acked_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages (group_id, id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_bots_username ON chat_bots (username);
CREATE INDEX IF NOT EXISTS idx_group_bot_members_bot ON group_bot_members (bot_id);
CREATE INDEX IF NOT EXISTS idx_polls_group ON polls (group_id, closed_at);
CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions (message_id);
CREATE INDEX IF NOT EXISTS idx_group_message_acks_lookup ON group_message_acks (group_id, message_id);
