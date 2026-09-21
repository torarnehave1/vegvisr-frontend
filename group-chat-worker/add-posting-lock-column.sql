-- Add posting-lock toggle to groups table.
-- When posting_locked = 1, only the group's created_by user (and bot user_ids
-- prefixed with `bot:`) can post messages or create polls. Members can still
-- read, react, vote, and submit questions/suggestions via separate flows.
-- Default 0 = unlocked, so existing groups behave unchanged.

ALTER TABLE groups ADD COLUMN posting_locked INTEGER NOT NULL DEFAULT 0;
