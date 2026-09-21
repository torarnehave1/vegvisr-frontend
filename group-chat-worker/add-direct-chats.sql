CREATE TABLE IF NOT EXISTS direct_chats (
  group_id TEXT PRIMARY KEY REFERENCES groups(id),
  source_group_id TEXT NOT NULL REFERENCES groups(id),
  user_low TEXT NOT NULL,
  user_high TEXT NOT NULL,
  CHECK (user_low < user_high),
  CHECK (substr(group_id, 1, 3) = 'dm_'),
  UNIQUE (source_group_id, user_low, user_high)
);

CREATE TRIGGER IF NOT EXISTS direct_members_insert
BEFORE INSERT ON group_members
WHEN substr(NEW.group_id, 1, 3) = 'dm_'
AND NOT EXISTS (
  SELECT 1 FROM direct_chats WHERE group_id = NEW.group_id
  AND NEW.user_id IN (user_low, user_high) AND NEW.role = 'member'
)
BEGIN SELECT RAISE(ABORT, 'Direct conversations have two fixed participants'); END;

CREATE TRIGGER IF NOT EXISTS direct_members_update
BEFORE UPDATE ON group_members
WHEN substr(OLD.group_id, 1, 3) = 'dm_' OR substr(NEW.group_id, 1, 3) = 'dm_'
BEGIN SELECT RAISE(ABORT, 'Direct participants cannot be changed'); END;

CREATE TRIGGER IF NOT EXISTS direct_members_delete
BEFORE DELETE ON group_members
WHEN substr(OLD.group_id, 1, 3) = 'dm_'
BEGIN SELECT RAISE(ABORT, 'Direct participants cannot be removed'); END;