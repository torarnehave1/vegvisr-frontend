-- Group chat schema for hallo_vegvisr_chat

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  graph_id TEXT,
  image_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  posting_locked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at INTEGER NOT NULL,
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
  video_duration_ms INTEGER
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS device_tokens (
  fcm_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages (group_id, id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens (user_id);
