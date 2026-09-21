ALTER TABLE group_messages ADD COLUMN forwarded_from_message_id INTEGER;
ALTER TABLE group_messages ADD COLUMN forwarded_from_user_id TEXT;
ALTER TABLE group_messages ADD COLUMN forwarded_from_user_name TEXT;
