-- Pinned/welcome message support: a group owner (or Superadmin) can pin an
-- existing message in the group as a welcome/announcement. Members see it as
-- a banner until they acknowledge it (soft gate — does not block chat).
-- Note: D1/SQLite does not support IF NOT EXISTS for ADD COLUMN.

ALTER TABLE groups ADD COLUMN pinned_message_id INTEGER;

CREATE TABLE IF NOT EXISTS group_message_acks (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  acked_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_group_message_acks_lookup ON group_message_acks (group_id, message_id);
