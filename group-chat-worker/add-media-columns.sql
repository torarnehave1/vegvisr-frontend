-- Adds media (image/video) columns to group_messages for chat attachments
-- Run against D1: hallo_vegvisr_chat
-- Note: D1/SQLite does not support IF NOT EXISTS for ADD COLUMN.
-- If you re-run this and a column already exists, the statement will error.

ALTER TABLE group_messages ADD COLUMN media_url TEXT;
ALTER TABLE group_messages ADD COLUMN media_object_key TEXT;
ALTER TABLE group_messages ADD COLUMN media_content_type TEXT;
ALTER TABLE group_messages ADD COLUMN media_size INTEGER;
