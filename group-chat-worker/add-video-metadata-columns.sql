-- Adds video preview metadata columns to group_messages
-- Run against D1: hallo_vegvisr_chat
-- Note: D1/SQLite does not support IF NOT EXISTS for ADD COLUMN.
-- If you re-run this and a column already exists, the statement will error.

ALTER TABLE group_messages ADD COLUMN video_thumbnail_url TEXT;
ALTER TABLE group_messages ADD COLUMN video_duration_ms INTEGER;
